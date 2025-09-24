import path from "node:path";
import process from "node:process";
import { Command } from "commander";
import { loadConfig } from "../config/index.js";
import { startServer } from "./server.js";

const program = new Command();

program
	.name("imap-mcp")
	.description("Start the IMAP MCP server")
	.option(
		"--config <path>",
		"Path to the JSON configuration file",
		"config.json",
	);

async function main(): Promise<void> {
	await program.parseAsync(process.argv);
	const options = program.opts<{ config: string }>();
	const configPath = options.config || "config.json";

	try {
		const config = await loadConfig(configPath);
		const resolvedPath = path.isAbsolute(configPath)
			? configPath
			: path.resolve(process.cwd(), configPath);
		console.log(`Loaded configuration from ${resolvedPath}`);
		const server = startServer(config);
		server.on("error", (error) => {
			console.error(`HTTP server error: ${(error as Error).message}`);
			process.exit(1);
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : JSON.stringify(error, null, 2);
		console.error(message);
		process.exit(1);
	}
}

void main();
