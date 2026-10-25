import { Inject, MiddlewareConsumer, Module, type DynamicModule, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import session from 'express-session';
import { SERVER_CONFIG, type ServerConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { IdentityController } from './identity.controller';
import { IdentityGuard } from './identity.guard';
import { IdentityService } from './identity.service';
import { IDLE_MS, PostgresSessionStore, SESSION_COOKIE } from './session.store';

@Module({})
export class IdentityModule implements NestModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: IdentityModule,
      imports: [DatabaseModule.register(config)],
      controllers: [IdentityController],
      providers: [{ provide: SERVER_CONFIG, useValue: config }, IdentityService, PostgresSessionStore, { provide: APP_GUARD, useClass: IdentityGuard }],
    };
  }
  constructor(@Inject(SERVER_CONFIG) private readonly config: ServerConfig, private readonly store: PostgresSessionStore) {}
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(session({
      name: SESSION_COOKIE, secret: this.config.SESSION_SECRET, store: this.store,
      resave: false, saveUninitialized: false, rolling: true,
      cookie: { httpOnly: true, secure: this.config.NODE_ENV === 'production', sameSite: 'lax', maxAge: IDLE_MS, path: '/' },
    })).exclude('api/health', 'api/ready').forRoutes('*path');
  }
}
