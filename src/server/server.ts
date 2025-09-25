import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { z } from "zod";
import type { Config } from "../config/index.js";
import { listAccounts, readMessage, searchMessages } from "../imap/index.js";
import {
	AccountListItemSchema,
	AccountSchema,
	FullMessageSchema,
	MessageListItemSchema,
	ReadMessageInputSchema,
	SearchInputSchema,
} from "../types/index.js";

export function createMcpServer(config: Config): McpServer {
	const accounts = [...config.accounts];
	const mcp = new McpServer({ name: "imap-mcp-server", version: "0.1.0" });

	const toStructuredResponse = <T>(payload: T) => ({
		structuredContent: payload,
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(payload, null, 2),
			},
		],
	});

	mcp.registerTool(
		"list_accounts",
		{
			title: "List IMAP accounts",
			description: "Returns configured account names",
			inputSchema: {},
			outputSchema: { accounts: z.array(AccountListItemSchema) },
		},
		async () => {
			const payload = { accounts: await listAccounts(accounts) };
			return toStructuredResponse(payload);
		},
	);

	mcp.registerTool(
		"search_messages",
		{
			title: "Search messages",
			description:
				"Search INBOX using a portable TEXT query. Returns basic metadata and UIDs.",
			inputSchema: SearchInputSchema.shape,
			outputSchema: {
				results: z.array(MessageListItemSchema),
			},
		},
		async ({ accountName, searchQuery, limit }) => {
			const account = accounts.find((a) => a.name === accountName);
			if (!account) throw new Error(`Unknown account: ${accountName}`);
			AccountSchema.parse(account);

			const rows = await searchMessages(account, searchQuery, limit);
			const payload = { results: rows };
			return toStructuredResponse(payload);
		},
	);

	mcp.registerTool(
		"read_message",
		{
			title: "Read message",
			description: "Fetch full message by UID from INBOX.",
			inputSchema: ReadMessageInputSchema.shape,
			outputSchema: FullMessageSchema.shape,
		},
		async ({ accountName, id }) => {
			const account = accounts.find((a) => a.name === accountName);
			if (!account) throw new Error(`Unknown account: ${accountName}`);

			const msg = await readMessage(account, id);
			if (!msg) throw new Error(`Message not found: UID ${id}`);
			const payload = FullMessageSchema.parse(msg);
			return toStructuredResponse(payload);
		},
	);

	return mcp;
}

export function createHttpApp(config: Config): {
	app: express.Express;
	mcp: McpServer;
} {
	const app = express();
	app.use(express.json());
	// Add CORS middleware before your MCP routes
	app.use(
		cors({
			origin: "*",
			exposedHeaders: ["Mcp-Session-Id"],
			allowedHeaders: ["Content-Type", "mcp-session-id"],
		}),
	);

	// Map to store transports and servers by session ID
	const sessions: {
		[sessionId: string]: {
			transport: StreamableHTTPServerTransport;
			server: McpServer;
		};
	} = {};

	const sendJsonRpcError = (
		res: express.Response,
		status: number,
		message: string,
		code = -32000,
		id: number | string | null = null,
	): void => {
		res.status(status).json({
			jsonrpc: "2.0",
			error: { code, message },
			id,
		});
	};

	const ensurePostHeadersValid = (
		req: express.Request,
		res: express.Response,
		id: number | string | null,
	): boolean => {
		const acceptHeader = req.headers.accept;
		if (
			!acceptHeader?.includes("application/json") ||
			!acceptHeader.includes("text/event-stream")
		) {
			sendJsonRpcError(
				res,
				406,
				"Not Acceptable: Client must accept both application/json and text/event-stream",
				-32000,
				id,
			);
			return false;
		}

		const contentType = req.headers["content-type"];
		if (!contentType?.includes("application/json")) {
			sendJsonRpcError(
				res,
				415,
				"Unsupported Media Type: Content-Type must be application/json",
				-32000,
				id,
			);
			return false;
		}

		return true;
	};

	const createSession = async (): Promise<{
		sessionId: string;
		transport: StreamableHTTPServerTransport;
	}> => {
		const sessionId = randomUUID();
		const mcp = createMcpServer(config);
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () => sessionId,
			onsessioninitialized: (initializedSessionId) => {
				if (initializedSessionId !== sessionId) {
					const existing = sessions[sessionId];
					if (existing) {
						sessions[initializedSessionId] = existing;
						delete sessions[sessionId];
					}
				}
			},
		});

		sessions[sessionId] = { transport, server: mcp };

		transport.onclose = () => {
			const activeSessionId = transport.sessionId ?? sessionId;
			delete sessions[activeSessionId];
		};

		await mcp.connect(transport);
		return { sessionId, transport };
	};

	// Handle POST requests for client-to-server communication
	app.post("/mcp", async (req, res) => {
		const requestId = (req.body?.id ?? null) as number | string | null;
		const sessionId = req.headers["mcp-session-id"] as string | undefined;

		try {
			if (sessionId && sessions[sessionId]) {
				const { transport } = sessions[sessionId];
				await transport.handleRequest(req, res, req.body);
				return;
			}

			if (!sessionId && req.body?.method === "sessions/create") {
				if (!ensurePostHeadersValid(req, res, requestId)) return;
				const { sessionId: newSessionId } = await createSession();
				res.setHeader("Mcp-Session-Id", newSessionId);
				res.status(200).json({
					jsonrpc: "2.0",
					id: requestId,
					result: { sessionId: newSessionId },
				});
				return;
			}

			if (!sessionId && isInitializeRequest(req.body)) {
				const { transport } = await createSession();
				await transport.handleRequest(req, res, req.body);
				return;
			}

			sendJsonRpcError(
				res,
				400,
				"Bad Request: No valid session ID provided",
				-32000,
				requestId,
			);
		} catch (error) {
			console.error("Error handling MCP request:", error);
			if (!res.headersSent) {
				sendJsonRpcError(res, 500, "Internal server error", -32603, requestId);
			}
		}
	});

	// Reusable handler for GET and DELETE requests
	const handleSessionRequest = async (
		req: express.Request,
		res: express.Response,
	) => {
		const sessionId = req.headers["mcp-session-id"] as string | undefined;
		if (!sessionId || !sessions[sessionId]) {
			res.status(400).send("Invalid or missing session ID");
			return;
		}

		const { transport } = sessions[sessionId];
		await transport.handleRequest(req, res);
	};

	// Handle GET requests for server-to-client notifications via SSE
	app.get("/mcp", handleSessionRequest);

	// Handle DELETE requests for session termination
	app.delete("/mcp", handleSessionRequest);

	// Create a placeholder MCP server for the return value
	const mcp = createMcpServer(config);

	return { app, mcp };
}

export function startServer(config: Config): Server {
	const { app } = createHttpApp(config);
	const port = Number(process.env.PORT) || config.server.port;
	return app.listen(port, () => {
		console.log(`MCP IMAP server on http://localhost:${port}/mcp`);
	});
}
