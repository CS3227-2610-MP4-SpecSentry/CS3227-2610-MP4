import { Module, type DynamicModule } from '@nestjs/common';
import { SERVER_CONFIG, type ServerConfig } from '../config';
import { DatabaseService } from './database.service';

@Module({})
export class DatabaseModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [{ provide: SERVER_CONFIG, useValue: config }, DatabaseService],
      exports: [DatabaseService],
    };
  }
}
