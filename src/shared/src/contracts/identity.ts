import { z } from 'zod';

export const accountRoleSchema = z.enum(['CONTRIBUTOR', 'REVIEWER', 'RELEASE_MAINTAINER']);
export type AccountRole = z.infer<typeof accountRoleSchema>;
export const usernameSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9._-]+$/).transform((value) => value.toLowerCase());
export const loginRequestSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(256) }).strict();
export const accountSchema = z.object({ id: z.string(), username: z.string(), role: accountRoleSchema }).strict();
export type Account = z.infer<typeof accountSchema>;
export const sessionResponseSchema = z.object({ account: accountSchema, csrfToken: z.string().length(64), expiresAt: z.number() }).strict();
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export const csrfResponseSchema = z.object({ csrfToken: z.string().length(64) }).strict();
