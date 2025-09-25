import { z } from "zod";

export const ImapCredentialsSchema = z
	.object({
		host: z.string().min(1).describe("The IMAP server hostname"),
		port: z.number().int().positive().describe("The IMAP server port"),
		secure: z
			.boolean()
			.default(true)
			.describe("Whether to use a secure connection"),
		auth: z.object({
			user: z.string().min(1).describe("The username for authentication"),
			pass: z.string().min(1).describe("The password for authentication"),
		}),
	})
	.strict();

export const AccountSchema = z
	.object({
		name: z.string().min(1).describe("The name of the account"),
		description: z.string().min(1).describe("A description of the account"),
		imap: ImapCredentialsSchema.describe(
			"IMAP settings and credentials for the account",
		),
	})
	.strict();
export type Account = z.infer<typeof AccountSchema>;

export const AccountListItemSchema = z.object({
	name: z.string().describe("The name of the account (to use in requests)"),
	description: z.string().describe("A description of the account"),
	imapUsername: z.string().describe("The IMAP username for the account"),
});
export type AccountListItem = z.infer<typeof AccountListItemSchema>;

export const SearchQuerySchema = z.object({
	keyword: z.string().optional().describe("Search all fields for this keyword"),
	unKeyword: z
		.string()
		.optional()
		.describe("Exclude messages containing this keyword"),
	since: z
		.string()
		.optional()
		.describe("Search for messages sent since this date"),
	on: z.string().optional().describe("Search for messages sent on this date"),
	before: z
		.string()
		.optional()
		.describe("Search for messages sent before this date"),
	subject: z
		.string()
		.optional()
		.describe("Search for messages with this subject"),
	body: z.string().optional().describe("Search for messages with this body"),
	bcc: z.string().optional().describe("Search for messages with this BCC"),
	cc: z.string().optional().describe("Search for messages with this CC"),
	to: z
		.string()
		.optional()
		.describe("Search for messages sent to this address"),
	from: z
		.string()
		.optional()
		.describe("Search for messages sent from this address"),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchInputSchema = z.object({
	accountName: z.string().min(1).describe("The name of the account to search"),
	searchQuery: SearchQuerySchema.describe("The search query parameters"),
	limit: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Max number of results to return"),
});
export type SearchInput = z.infer<typeof SearchInputSchema>;

export const ReadMessageInputSchema = z.object({
	accountName: z
		.string()
		.min(1)
		.describe("The name of the account to read the message from"),
	id: z.number().int().positive().describe("The UID of the message to read"),
});
export type ReadMessageInput = z.infer<typeof ReadMessageInputSchema>;

export const LoadMessagesInputSchema = z
	.object({
		accountName: z
			.string()
			.min(1)
			.describe("The name of the account to read the messages from"),
		ids: z
			.array(
				z
					.number()
					.int()
					.positive()
					.describe("A message UID to load"),
			)
			.describe("The message UIDs to fetch"),
	})
	.strict();
export type LoadMessagesInput = z.infer<typeof LoadMessagesInputSchema>;

export const MessageListItemSchema = z
	.object({
		uid: z
			.number()
			.int()
			.nonnegative()
			.describe("The unique identifier of the message"),
		date: z.string().describe("The date the message was sent"),
		from: z.array(z.string()).describe("The sender(s) of the message"),
		to: z.array(z.string()).describe("The recipient(s) of the message"),
		subject: z.string().describe("The subject of the message"),
		snippet: z.string().describe("A short snippet of the message content"),
	})
	.strict();
export type MessageListItem = z.infer<typeof MessageListItemSchema>;

export const FullMessageSchema = z
	.object({
		uid: z
			.number()
			.int()
			.nonnegative()
			.describe("The unique identifier of the message"),
		date: z.string().describe("The date the message was sent"),
		from: z.array(z.string()).describe("The sender(s) of the message"),
		to: z.array(z.string()).describe("The recipient(s) of the message"),
		cc: z.array(z.string()).describe("The CC recipient(s) of the message"),
		subject: z.string().describe("The subject of the message"),
		headers: z.record(z.array(z.string())).describe("All email headers"),
		text: z
			.string()
			.optional()
			.describe("The plain text content of the message"),
		html: z.string().optional().describe("The HTML content of the message"),
		attachments: z.array(
			z
				.object({
					filename: z
						.string()
						.optional()
						.describe("The filename of the attachment"),
					contentType: z
						.string()
						.optional()
						.describe("The content type of the attachment"),
					size: z
						.number()
						.int()
						.nonnegative()
						.describe("The size of the attachment in bytes"),
				})
				.strict()
				.describe("An attachment of the message"),
		),
	})
	.strict();
export type FullMessage = z.infer<typeof FullMessageSchema>;

export const LoadMessagesOutputSchema = z
	.object({
		messages: z
			.array(FullMessageSchema)
			.describe("Messages that were found for the requested UIDs"),
	})
	.strict();
export type LoadMessagesOutput = z.infer<typeof LoadMessagesOutputSchema>;
