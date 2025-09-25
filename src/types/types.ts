import { z } from "zod";

export const ImapCredentialsSchema = z
	.object({
		host: z.string().min(1),
		port: z.number().int().positive(),
		secure: z.boolean().default(true),
		auth: z.object({
			user: z.string().min(1),
			pass: z.string().min(1),
		}),
	})
	.strict();

export const AccountSchema = z
	.object({
		name: z.string().min(1),
		description: z.string().min(1),
		imap: ImapCredentialsSchema,
	})
	.strict();
export type Account = z.infer<typeof AccountSchema>;

export const AccountListItemSchema = z.object({
	name: z.string(),
	description: z.string(),
	imapUsername: z.string(),
});
export type AccountListItem = z.infer<typeof AccountListItemSchema>;

export const SearchQuerySchema = z.object({
	keyword: z.string().optional(),
	unKeyword: z.string().optional(),
	since: z.string().optional(),
	on: z.string().optional(),
	before: z.string().optional(),
	subject: z.string().optional(),
	body: z.string().optional(),
	bcc: z.string().optional(),
	cc: z.string().optional(),
	to: z.string().optional(),
	from: z.string().optional(),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchInputSchema = z.object({
	accountName: z.string().min(1),
	searchQuery: SearchQuerySchema,
	limit: z.number().int().positive().optional(),
});
export type SearchInput = z.infer<typeof SearchInputSchema>;

export const ReadMessageInputSchema = z.object({
	accountName: z.string().min(1),
	id: z.number().int().positive(),
});
export type ReadMessageInput = z.infer<typeof ReadMessageInputSchema>;

export const MessageListItemSchema = z
	.object({
		uid: z.number().int().nonnegative(),
		date: z.string(),
		from: z.array(z.string()),
		to: z.array(z.string()),
		subject: z.string(),
		snippet: z.string(),
	})
	.strict();
export type MessageListItem = z.infer<typeof MessageListItemSchema>;

export const FullMessageSchema = z
	.object({
		uid: z.number().int().nonnegative(),
		date: z.string(),
		from: z.array(z.string()),
		to: z.array(z.string()),
		cc: z.array(z.string()),
		subject: z.string(),
		headers: z.record(z.array(z.string())),
		text: z.string().optional(),
		html: z.string().optional(),
		attachments: z.array(
			z
				.object({
					filename: z.string().optional(),
					contentType: z.string().optional(),
					size: z.number().int().nonnegative(),
				})
				.strict(),
		),
	})
	.strict();
export type FullMessage = z.infer<typeof FullMessageSchema>;
