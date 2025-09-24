import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { AccountsConfigSchema } from "../types/index.js";

const ServerConfigSchema = z
	.object({
		port: z.number().int().min(1).max(65_535).default(3333),
	})
	.strict();

export const ConfigSchema = z
	.object({
		accounts: AccountsConfigSchema,
		server: ServerConfigSchema.default({ port: 3333 }),
	})
	.strict();

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "ConfigError";
	}
}

export async function loadConfig(configPath: string): Promise<Config> {
	const absolutePath = path.isAbsolute(configPath)
		? configPath
		: path.resolve(process.cwd(), configPath);

	let fileContents: string;
	try {
		fileContents = await readFile(absolutePath, "utf8");
	} catch (error) {
		throw new ConfigError(
			`Unable to read config file at ${absolutePath}: ${(error as Error).message}`,
		);
	}

	let raw: unknown;
	try {
		raw = JSON.parse(fileContents);
	} catch (error) {
		throw new ConfigError(
			`Invalid JSON in config file at ${absolutePath}: ${(error as Error).message}`,
		);
	}

	try {
		return ConfigSchema.parse(raw);
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new ConfigError(
				`Config validation failed for ${absolutePath}: ${error.errors
					.map((e) => `${e.path.join(".") || "root"}: ${e.message}`)
					.join(", ")}`,
			);
		}
		throw new ConfigError(
			`Unexpected error validating config at ${absolutePath}: ${(error as Error).message}`,
		);
	}
}
