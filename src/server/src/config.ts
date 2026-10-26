import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SESSION_SECRET: z.string().min(32),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_URL: z.string().url().refine(
    (value) => URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    'Must be a PostgreSQL URL',
  ),
  // OPEN-002 is unresolved. Neither nonempty placeholders nor an env assertion
  // can enable live traffic. Test providers are explicit in-process DI only.
  AI_LIVE_ENABLED: z.preprocess((value) => value === 'false' ? false : value === 'true' ? true : value,
    z.literal(false).default(false)),
  AI_BASE_URL: z.literal('https://soclaas-api.comp.nus.edu.sg/v1').default('https://soclaas-api.comp.nus.edu.sg/v1'),
  AI_API_KEY: z.string().max(4096).optional(),
  AI_MODEL: z.string().min(1).max(256).optional(),
});

export type ServerConfig = z.infer<typeof environmentSchema>;
export const SERVER_CONFIG = Symbol('SERVER_CONFIG');

export function readConfig(environment: NodeJS.ProcessEnv): ServerConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    // Report field names only: Zod issues may otherwise include secret input.
    throw new Error(`Invalid server configuration: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`);
  }
  return result.data;
}
