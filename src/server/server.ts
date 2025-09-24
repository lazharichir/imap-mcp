import type { Server } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { listAccounts, readMessage, searchMessages } from "../imap/index.js";
import {
	AccountSchema,
	FullMessageSchema,
	MessageListItemSchema,
	ReadMessageInputSchema,
	SearchInputSchema,
} from "../types/index.js";
import type { Config } from "../config/index.js";

export function createMcpServer(config: Config): McpServer {
	const accounts = [...config.accounts];
	const mcp = new McpServer({ name: "imap-mcp-server", version: "0.1.0" });

	mcp.registerTool(
		"list_accounts",
		{
			title: "List IMAP accounts",
			description: "Returns configured account names",
			inputSchema: {},
			outputSchema: { accounts: z.array(z.string()) },
		},
		async () => ({
			content: [
				{
					type: "text",
					text: JSON.stringify(
						{ accounts: await listAccounts(accounts) },
						null,
						2,
					),
				},
			],
		}),
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
		async ({ accountName, searchQuery }) => {
			const account = accounts.find((a) => a.name === accountName);
			if (!account) throw new Error(`Unknown account: ${accountName}`);
			AccountSchema.parse(account);

			const rows = await searchMessages(account, searchQuery);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ results: rows }, null, 2),
					},
				],
			};
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
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(msg, null, 2),
					},
				],
			};
		},
	);

	return mcp;
}

export function createHttpApp(config: Config): {
	app: express.Express;
	mcp: McpServer;
} {
	const mcp = createMcpServer(config);
	const app = express();
	app.use(express.json({ limit: "1mb" }));

	app.all("/mcp", async (req, res) => {
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () =>
				`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		});
		await mcp.connect(transport);
		await transport.handleRequest(req, res);
	});

	return { app, mcp };
}

export function startServer(config: Config): Server {
	const { app } = createHttpApp(config);
	const port = Number(process.env.PORT) || config.server.port;
	return app.listen(port, () => {
		console.log(`MCP IMAP server on http://localhost:${port}/mcp`);
	});
}
