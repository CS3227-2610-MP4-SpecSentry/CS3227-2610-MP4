import { resolve } from 'node:path';
import { config as loadEnvironment } from 'dotenv';

/** Load ignored local configuration while preserving already-injected runtime values. */
export function loadRootEnvironment(): void {
  const repositoryRoot = resolve(__dirname, '../../..');
  loadEnvironment({
    path: [resolve(repositoryRoot, '.env.local'), resolve(repositoryRoot, '.env')],
    quiet: true,
  });
}
