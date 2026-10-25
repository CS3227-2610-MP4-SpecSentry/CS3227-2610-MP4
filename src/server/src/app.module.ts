import { Module, type DynamicModule } from '@nestjs/common';
import { SERVER_CONFIG, type ServerConfig } from './config';
import { DatabaseService } from './database/database.service';
import { HealthController } from './health/health.controller';

@Module({})
export class AppModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [{ provide: SERVER_CONFIG, useValue: config }, DatabaseService],
    };
  }
}
