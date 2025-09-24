import { z } from "zod";

export const AccountSchema = z.object({
	name: z.string().min(1),
	host: z.string().min(1),
	port: z.number().int().positive(),
	secure: z.boolean().default(true),
	auth: z.object({
		user: z.string().min(1),
		pass: z.string().min(1),
	}),
});
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
	id: z.number().int().positive(), // UID
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
