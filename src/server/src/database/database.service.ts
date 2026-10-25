import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { SERVER_CONFIG, type ServerConfig } from '../config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(SERVER_CONFIG) config: ServerConfig) {
    const adapter = new PrismaPg({
      connectionString: config.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 3000,
      query_timeout: 3000,
      statement_timeout: 3000,
    });
    this.client = new PrismaClient({ adapter, log: [] });
  }

  async checkConnection(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
