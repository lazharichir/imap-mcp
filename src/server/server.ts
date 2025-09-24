import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { listAccounts, readMessage, searchMessages } from "../imap/index.js";
import {
	AccountSchema,
	AccountsConfigSchema,
	ReadMessageInputSchema,
	SearchInputSchema,
} from "../types/index.js";

// --- Load accounts config from env JSON ---
const accountsEnv = process.env.IMAP_ACCOUNTS_JSON;
if (!accountsEnv) {
	throw new Error("IMAP_ACCOUNTS_JSON is required");
}
const ACCOUNTS = AccountsConfigSchema.parse(JSON.parse(accountsEnv));

// --- MCP server and tools ---
const mcp = new McpServer({ name: "imap-mcp-server", version: "0.1.0" });

// list_accounts
mcp.registerTool(
	"list_accounts",
	{
		title: "List IMAP accounts",
		description: "Returns configured account names",
		inputSchema: {}, // no input
		outputSchema: { accounts: z.array(z.string()) },
	},
	async () => ({
		content: [
			{
				type: "text",
				text: JSON.stringify(
					{ accounts: await listAccounts(ACCOUNTS) },
					null,
					2,
				),
			},
		],
	}),
);

// search_messages
mcp.registerTool(
	"search_messages",
	{
		title: "Search messages",
		description:
			"Search INBOX using a portable TEXT query. Returns basic metadata and UIDs.",
		inputSchema: SearchInputSchema.shape,
	},
	async ({ accountName, searchQuery }) => {
		const account = ACCOUNTS.find((a) => a.name === accountName);
		if (!account) throw new Error(`Unknown account: ${accountName}`);
		// validate again for safety
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

// read_message
mcp.registerTool(
	"read_message",
	{
		title: "Read message",
		description: "Fetch full message by UID from INBOX.",
		inputSchema: ReadMessageInputSchema.shape,
	},
	async ({ accountName, id }) => {
		const account = ACCOUNTS.find((a) => a.name === accountName);
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

// --- Streamable HTTP transport ---
const app = express();
app.use(express.json({ limit: "1mb" }));

app.all("/mcp", async (req, res) => {
	// Create a new transport for each request
	const transport = new StreamableHTTPServerTransport({
		sessionIdGenerator: () =>
			`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
	});
	await mcp.connect(transport);

	// Handle the request
	await transport.handleRequest(req, res);
});

const port = Number(process.env.PORT || 3333);
app.listen(port, () => {
	console.log(`MCP IMAP server on http://localhost:${port}/mcp`);
});
