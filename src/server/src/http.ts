import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import { SERVER_CONFIG, type ServerConfig } from './config';

@Catch()
class SafeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const oversizedBody = exception && typeof exception === 'object' && 'type' in exception && exception.type === 'entity.too.large';
    const status = exception instanceof HttpException ? exception.getStatus() : oversizedBody ? 413 : 500;
    const codes: Record<number, string> = {
      401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
      409: 'CONFLICT', 413: 'VALIDATION_FAILED', 422: 'VALIDATION_FAILED', 429: 'RATE_LIMITED',
    };
    const code = codes[status] ?? 'INTERNAL_ERROR';
    response.status(status).json({ code, message: status === 404 ? 'Route not found.' : 'Request could not be completed.', correlationId: response.getHeader('x-request-id') });
  }
}

export function configureHttp(app: NestExpressApplication, clientDirectory?: string): void {
  const config = app.get<ServerConfig>(SERVER_CONFIG);
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('x-request-id', randomUUID());
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalFilters(new SafeExceptionFilter());
  if (clientDirectory) {
    const server: express.Express = app.getHttpAdapter().getInstance();
    server.use('/assets', express.static(join(clientDirectory, 'assets'), { index: false, redirect: false }));
    // Express 5 RegExp route: never turn an API or missing asset into SPA HTML.
    server.get(/^\/(?!api(?:\/|$)|assets(?:\/|$)).*/, (_request, response) => {
      response.sendFile(join(clientDirectory, 'index.html'));
    });
  }
}
