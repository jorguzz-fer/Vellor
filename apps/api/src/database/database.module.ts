import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AppConfig } from '../config/app-config';
import * as schemaModule from './schema';

export type Database = PostgresJsDatabase<typeof schemaModule.schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbExecutor = Database | Transaction;

export const DB = Symbol('DB');

export const InjectDb = () => Inject(DB);

export function createDatabase(url: string, options: { max?: number } = {}) {
  const client = postgres(url, {
    max: options.max ?? 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema: schemaModule.schema, casing: 'snake_case' });
  return { client, db };
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly client: ReturnType<typeof postgres>;
  readonly db: Database;

  constructor(config: AppConfig) {
    const created = createDatabase(config.env.DATABASE_URL, { max: config.isTest ? 5 : 10 });
    this.client = created.client;
    this.db = created.db;
  }

  async ping(): Promise<boolean> {
    await this.client`select 1`;
    return true;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: DB,
      useFactory: (service: DatabaseService) => service.db,
      inject: [DatabaseService],
    },
  ],
  exports: [DB, DatabaseService],
})
export class DatabaseModule {}
