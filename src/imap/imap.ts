import { ImapFlow, type FetchMessageObject } from "imapflow";
import type { Account, FullMessage, MessageListItem } from "../types/types.js";

type ClientEntry = { client: ImapFlow; lastUsed: number };
const pool = new Map<string, ClientEntry>();

async function getClient(a: Account): Promise<ImapFlow> {
	const cached = pool.get(a.name);
	if (cached?.client?.usable) {
		cached.lastUsed = Date.now();
		return cached.client;
	}
	const client = new ImapFlow({
		host: a.host,
		port: a.port,
		secure: a.secure,
		auth: a.auth,
	});
	await client.connect();
	pool.set(a.name, { client, lastUsed: Date.now() });
	return client;
}

// simple LRU cleanup
setInterval(() => {
	const now = Date.now();
	for (const [k, v] of pool) {
		if (now - v.lastUsed > 5 * 60_000) {
			try {
				v.client.close();
			} catch {
				// Ignore close errors during cleanup
			}
			pool.delete(k);
		}
	}
}, 60_000).unref();

export async function listAccounts(accounts: Account[]): Promise<string[]> {
	return accounts.map((a) => a.name);
}

export async function searchMessages(
	account: Account,
	rawQuery: string,
): Promise<MessageListItem[]> {
	const c = await getClient(account);
	await c.mailboxOpen("INBOX");

	// Basic, portable IMAP search: try TEXT match. You can extend to parse query.
	const uids = await c.search({ body: rawQuery }, { uid: true });

	if (!uids || (Array.isArray(uids) && uids.length === 0)) return [];

	const uidArray = Array.isArray(uids) ? uids : [];
	const rows: MessageListItem[] = [];
	for await (const msg of c.fetch(uidArray, {
		uid: true,
		envelope: true,
		source: false,
		bodyStructure: true,
		bodyParts: ["text"],
	})) {
		rows.push(toListItem(msg));
	}
	return rows.sort((a, b) => a.uid - b.uid);
}

export async function readMessage(
	account: Account,
	uid: number,
): Promise<FullMessage | null> {
	const c = await getClient(account);
	await c.mailboxOpen("INBOX");

	const iter = c.fetch([uid], {
		uid: true,
		envelope: true,
		headers: true,
		bodyStructure: true,
		source: false,
		bodyParts: ["text", "html"],
	});

	const first = await iter.next();
	if (first.done) return null;
	const msg = first.value as FetchMessageObject;

	const text = partText(msg, "text");
	const html = partText(msg, "html");
	const attachments = (msg.bodyStructure?.childNodes || [])
		.filter((p) => {
			const disp = p.disposition as unknown as { type?: string };
			return (
				disp &&
				typeof disp === "object" &&
				disp.type?.toLowerCase() === "attachment"
			);
		})
		.map((p) => {
			const disp = p.disposition as unknown as {
				params?: { filename?: string };
			};
			return {
				filename: disp?.params?.filename || p.parameters?.name,
				contentType: p.type,
				size: Number(p.size || 0),
			};
		});

	return {
		uid: msg.uid ?? 0,
		date: msg.envelope?.date?.toISOString() || "",
		from: (msg.envelope?.from || []).map((a) => formatAddr(a)),
		to: (msg.envelope?.to || []).map((a) => formatAddr(a)),
		cc: (msg.envelope?.cc || []).map((a) => formatAddr(a)),
		subject: msg.envelope?.subject || "",
		headers:
			msg.headers instanceof Map
				? Object.fromEntries(
						[...msg.headers.entries()].map(([k, v]) => [
							k,
							Array.isArray(v) ? v : [String(v)],
						]),
					)
				: {},
		text,
		html,
		attachments,
	};
}

function toListItem(msg: FetchMessageObject): MessageListItem {
	return {
		uid: msg.uid ?? 0,
		date: msg.envelope?.date?.toISOString() || "",
		from: (msg.envelope?.from || []).map((a) => formatAddr(a)),
		to: (msg.envelope?.to || []).map((a) => formatAddr(a)),
		subject: msg.envelope?.subject || "",
		snippet: deriveSnippet(msg),
	};
}

function deriveSnippet(msg: FetchMessageObject): string {
	const t = partText(msg, "text") || "";
	return t.replace(/\s+/g, " ").trim().slice(0, 160);
}

function partText(
	msg: FetchMessageObject,
	kind: "text" | "html",
): string | undefined {
	const partKey = [...(msg.bodyParts?.keys() || [])].find((k) =>
		k.toLowerCase().includes(kind),
	);
	if (!partKey) return undefined;
	const part = msg.bodyParts?.get(partKey);
	if (!part || (typeof part !== "string" && !Buffer.isBuffer(part)))
		return undefined;
	return String(part);
}

interface EmailAddress {
	name?: string;
	mailbox?: string;
	host?: string;
}

function formatAddr(a: EmailAddress): string {
	const name = a.name ? `"${a.name}"` : undefined;
	const addr = [a.mailbox, a.host].filter(Boolean).join("@");
	return name ? `${name} <${addr}>` : addr;
}
