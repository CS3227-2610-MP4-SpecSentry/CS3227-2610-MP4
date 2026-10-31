import 'reflect-metadata';
import { Controller, Get, Param, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { SafeAiError } from '../src/ai/gateway';
import { SERVER_CONFIG, readConfig } from '../src/config';
import { configureHttp } from '../src/http';

@Controller('synthetic-ai-error')
class SyntheticAiErrorController {
  @Get(':kind') error(@Param('kind') kind: string) {
    if(kind==='generic') throw new ServiceUnavailableException('private database details');
    if(kind==='RATE_LIMIT') throw new SafeAiError('RATE_LIMIT',999999999,'safe-request');
    if(kind==='INPUT_LIMIT') throw new SafeAiError('INPUT_LIMIT');
    if(kind==='ACCESS_LOST') throw new SafeAiError('ACCESS_LOST');
    if(kind==='SCOPE_CHANGED') throw new SafeAiError('SCOPE_CHANGED');
    throw new SafeAiError('DISABLED');
  }
}
describe('safe Patch Risk HTTP fallback',()=>{
  let app:NestExpressApplication;
  beforeAll(async()=>{
    const module=await Test.createTestingModule({controllers:[SyntheticAiErrorController],providers:[{provide:SERVER_CONFIG,
      useValue:readConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/test',SESSION_SECRET:'synthetic-safe-ai-errors-secret-32-chars'})}]}).compile();
    app=module.createNestApplication<NestExpressApplication>({logger:false});configureHttp(app);await app.init();
  });
  afterAll(async()=>{await app.close();});
  it.each([['DISABLED',503],['RATE_LIMIT',429],['INPUT_LIMIT',422],['ACCESS_LOST',403],['SCOPE_CHANGED',409]] as const)('maps only typed safe AI failure %s',async(reason,status)=>{
      const response=await request(app.getHttpServer()).get(`/api/synthetic-ai-error/${reason}`).expect(status);
      expect(response.body).toEqual({code:'AI_UNAVAILABLE',reason,message:'AI analysis is unavailable. Manual review remains available.',correlationId:response.headers['x-request-id']});
      if(reason==='RATE_LIMIT')expect(response.headers['retry-after']).toBe('86400');
      expect(response.text).not.toMatch(/stack|safe-request|private/);
    });
  it('keeps unrelated readiness errors generic',async()=>{
    const response=await request(app.getHttpServer()).get('/api/synthetic-ai-error/generic').expect(503);
    expect(response.body.code).toBe('INTERNAL_ERROR');expect(response.text).not.toContain('private database');
  });
});
