import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url().refine(
    (value) => URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    'Must be a PostgreSQL URL',
  ),
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
