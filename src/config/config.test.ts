import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ConfigError, loadConfig } from "./config.js";

const tempDirs: string[] = [];

async function createTempConfig(contents: string): Promise<string> {
	const dir = await mkdtemp(path.join(tmpdir(), "imap-config-test-"));
	tempDirs.push(dir);
	const filePath = path.join(dir, "config.json");
	await writeFile(filePath, contents, "utf8");
	return filePath;
}

afterEach(async () => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) {
			await rm(dir, { recursive: true, force: true });
		}
	}
});

describe("loadConfig", () => {
	it("loads and validates a full config file", async () => {
		const configPath = await createTempConfig(
			JSON.stringify(
				{
					server: { port: 4444 },
					accounts: [
						{
							name: "account-a",
							description: "Primary work account",
							imap: {
								host: "imap.example.com",
								port: 993,
								secure: false,
								auth: { user: "user", pass: "pass" },
							},
						},
					],
				},
				null,
				2,
			),
		);

		const config = await loadConfig(configPath);
		expect(config.server.port).toBe(4444);
		expect(config.accounts).toHaveLength(1);
		expect(config.accounts[0].name).toBe("account-a");
		expect(config.accounts[0].imap.secure).toBe(false);
	});

	it("applies defaults when optional fields are omitted", async () => {
		const configPath = await createTempConfig(
			JSON.stringify(
				{
					accounts: [
						{
							name: "account-b",
							description: "Fallback account",
							imap: {
								host: "imap.example.com",
								port: 143,
								auth: { user: "user", pass: "pass" },
							},
						},
					],
				},
				null,
				2,
			),
		);

		const config = await loadConfig(configPath);
		expect(config.server.port).toBe(3333);
		expect(config.accounts[0].imap.secure).toBe(true);
	});

	it("throws ConfigError for invalid JSON", async () => {
		const configPath = await createTempConfig("{ invalid json }");
		await expect(loadConfig(configPath)).rejects.toBeInstanceOf(ConfigError);
	});

	it("throws ConfigError for schema validation issues", async () => {
		const configPath = await createTempConfig(
			JSON.stringify(
				{
					accounts: [
						{
							description: "Missing name",
							imap: {
								host: "imap.example.com",
								port: 993,
								auth: { user: "user", pass: "pass" },
							},
						},
					],
				},
				null,
				2,
			),
		);

		await expect(loadConfig(configPath)).rejects.toBeInstanceOf(ConfigError);
	});

	it("throws ConfigError when file is missing", async () => {
		await expect(loadConfig("./does-not-exist.json"))
			.rejects.toBeInstanceOf(ConfigError);
	});
});
