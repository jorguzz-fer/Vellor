import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { loadEnv } from '../config/env';
import { createDatabase, type Database } from './database.module';

/** Pasta das migrations SQL geradas pelo drizzle-kit (mesma profundidade em src/ e dist/). */
export const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ?? path.resolve(__dirname, '../../drizzle');

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}

async function main(): Promise<void> {
  const env = loadEnv();
  const { client, db } = createDatabase(env.DATABASE_URL, { max: 1 });
  try {
    console.log(`Aplicando migrations de ${MIGRATIONS_DIR}...`);
    await runMigrations(db);
    console.log('Migrations aplicadas com sucesso.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
