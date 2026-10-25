import 'reflect-metadata';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { readConfig } from '../src/config';

describe('scaffold HTTP boundary', () => {
  let app: NestExpressApplication;
  const checkConnection = jest.fn();
  const clientDirectory = mkdtempSync(join(tmpdir(), 'specsentry-client-'));

  beforeAll(async () => {
    writeFileSync(join(clientDirectory, 'index.html'), '<h1>Scaffold</h1>');
    const module = await Test.createTestingModule({
      imports: [AppModule.register(readConfig({ SESSION_SECRET: 'synthetic-test-session-secret-32-chars', NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test' }))],
    }).overrideProvider(DatabaseService).useValue({ checkConnection }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false });
    configureHttp(app, clientDirectory);
    await app.init();
  });
  afterAll(async () => { await app.close(); rmSync(clientDirectory, { recursive: true }); });

  it('liveness works without a database and includes security headers', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', service: 'specsentry' });
    expect(checkConnection).not.toHaveBeenCalled();
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
  });
  it('reports ready only when the database query succeeds', async () => {
    checkConnection.mockResolvedValueOnce(undefined);
    await request(app.getHttpServer()).get('/api/ready').expect(200, { status: 'ready' });
  });
  it('does not disclose database failures', async () => {
    checkConnection.mockRejectedValueOnce(new Error('postgresql://secret:password@private-host/db'));
    const response = await request(app.getHttpServer()).get('/api/ready').expect(503);
    expect(response.body.correlationId).toBe(response.headers['x-request-id']);
    expect(response.body.code).toBe('INTERNAL_ERROR');
    expect(response.text).not.toMatch(/secret|password|private-host|stack/);
  });
  it.each(['/api', '/api/missing', '/api/health/other', '/assets/missing.js'])('does not use SPA fallback for %s', async (path) => {
    const response = await request(app.getHttpServer()).get(path).expect(404).expect('Content-Type', /json/);
    expect(response.body).toMatchObject({ code: 'NOT_FOUND', message: 'Route not found.' });
  });
  it('serves frontend HTML and does not treat POST as a page', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect(/Scaffold/);
    await request(app.getHttpServer()).post('/').expect(404);
  });
  it('rejects invalid configuration without echoing sensitive input', () => {
    expect(() => readConfig({ SESSION_SECRET: 'synthetic-test-session-secret-32-chars', DATABASE_URL: 'secret-value', PORT: '-1' })).toThrow('Invalid server configuration: PORT, DATABASE_URL');
  });
});
