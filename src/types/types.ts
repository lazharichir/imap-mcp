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

export const AccountsConfigSchema = z.array(AccountSchema).min(1);
export type AccountsConfig = z.infer<typeof AccountsConfigSchema>;

export const SearchInputSchema = z.object({
	accountName: z.string().min(1),
	searchQuery: z.string().min(1),
});
export type SearchInput = z.infer<typeof SearchInputSchema>;

export const ReadMessageInputSchema = z.object({
	accountName: z.string().min(1),
	id: z.number().int().positive(),
});
export type ReadMessageInput = z.infer<typeof ReadMessageInputSchema>;

export type MessageListItem = {
	uid: number;
	date: string;
	from: string[];
	to: string[];
	subject: string;
	snippet: string;
};

export type FullMessage = {
	uid: number;
	date: string;
	from: string[];
	to: string[];
	cc: string[];
	subject: string;
	headers: Record<string, string[]>;
	text?: string;
	html?: string;
	attachments: Array<{
		filename?: string;
		contentType?: string;
		size: number;
	}>;
};
