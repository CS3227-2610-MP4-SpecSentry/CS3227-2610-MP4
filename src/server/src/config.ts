import { z } from 'zod';

const aiFields = {
  AI_LIVE_ENABLED: z.preprocess((value) => value === 'false' ? false : value === 'true' ? true : value,
    z.boolean().default(false)),
  AI_BASE_URL: z.literal('https://soclaas-api.comp.nus.edu.sg/v1').default('https://soclaas-api.comp.nus.edu.sg/v1'),
  AI_API_KEY: z.string().max(4096).optional(),
  AI_MODEL: z.string().min(1).max(256).optional(),
  AI_CONTEXT_WINDOW: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
};
function requireLiveSettings(value: { AI_LIVE_ENABLED: boolean; AI_API_KEY?: string; AI_MODEL?: string; AI_CONTEXT_WINDOW?: number }, ctx: z.RefinementCtx) {
  if (!value.AI_LIVE_ENABLED) return;
  for (const field of ['AI_API_KEY', 'AI_MODEL'] as const) {
    const setting = value[field];
    if (!setting?.trim() || /^(?:placeholder|api-key-here|model-here|replace-me|YOUR_API_KEY)$/i.test(setting.trim()))
      ctx.addIssue({ code: 'custom', path: [field], message: 'Required live setting' });
  }
  if (value.AI_CONTEXT_WINDOW === undefined) ctx.addIssue({ code: 'custom', path: ['AI_CONTEXT_WINDOW'], message: 'Required live setting' });
}
const aiEnvironmentSchema = z.object(aiFields).superRefine(requireLiveSettings);
function normalizeDatabaseUrl(value: string): string {
  const url = new URL(value);
  if (url.hostname.endsWith('.neon.tech') && url.searchParams.get('sslmode') === 'require') {
    url.searchParams.set('sslmode', 'verify-full');
  }
  return url.toString();
}
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SESSION_SECRET: z.string().min(32),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_URL: z.string().url().refine(
    (value) => URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    'Must be a PostgreSQL URL',
  ).transform(normalizeDatabaseUrl),
  DEPLOYMENT_SOURCE_SHA: z.union([
    z.literal('local'),
    z.string().regex(/^[0-9a-f]{40}$/),
  ]).default('local'),
  ...aiFields,
}).superRefine(requireLiveSettings);

export type ServerConfig = z.infer<typeof environmentSchema>;
export type AiConfig = z.infer<typeof aiEnvironmentSchema>;
export const SERVER_CONFIG = Symbol('SERVER_CONFIG');
function parseConfig<T>(schema: z.ZodType<T>, environment: NodeJS.ProcessEnv): T {
  const result = schema.safeParse(environment);
  if (!result.success) {
    // Report field names only: Zod issues may otherwise include secret input.
    throw new Error(`Invalid server configuration: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`);
  }
  return result.data;
}
export function readConfig(environment: NodeJS.ProcessEnv): ServerConfig { return parseConfig(environmentSchema, environment); }
export function readAiConfig(environment: NodeJS.ProcessEnv): AiConfig { return parseConfig(aiEnvironmentSchema, environment); }
export function deploymentSourceRevision(environment: NodeJS.ProcessEnv = process.env): ServerConfig['DEPLOYMENT_SOURCE_SHA'] {
  return z.union([z.literal('local'), z.string().regex(/^[0-9a-f]{40}$/)])
    .parse(environment.DEPLOYMENT_SOURCE_SHA ?? 'local');
}
