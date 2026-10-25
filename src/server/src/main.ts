import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnvironment } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { readConfig } from './config';
import { configureHttp } from './http';

async function bootstrap(): Promise<void> {
  loadEnvironment({ path: resolve(__dirname, '../../../.env'), quiet: true });
  const config = readConfig(process.env);
  const clientDirectory = resolve(__dirname, '../../client/dist');
  if (config.NODE_ENV === 'production' && !existsSync(resolve(clientDirectory, 'index.html'))) {
    throw new Error('Client build missing');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), { logger: false });
  configureHttp(app, config.NODE_ENV === 'production' ? clientDirectory : undefined);
  app.enableShutdownHooks();
  await app.listen(config.PORT, '0.0.0.0');
  console.info(JSON.stringify({ event: 'server_started', port: config.PORT }));
}

void bootstrap().catch(() => {
  console.error(JSON.stringify({ event: 'startup_failed', message: 'Check server configuration and build output.' }));
  process.exitCode = 1;
});
