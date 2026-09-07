import type { INestApplication } from '@nestjs/common';
import { authenticator } from 'otplib';
import request, { type Test as SupertestTest } from 'supertest';
import { DatabaseService } from '../src/database/database.module';
import { runMigrations } from '../src/database/migrate';
import { seed } from '../src/database/seed';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  process.env.DATABASE_URL ??
  'postgres://vellor:vellor@localhost:5432/vellor_test';
process.env.APP_ENCRYPTION_KEY =
  process.env.APP_ENCRYPTION_KEY ?? 'test-encryption-key-0123456789-abcdefghij';
process.env.PAYMENTS_MOCK = 'true';
process.env.SWAGGER_ENABLED = 'false';

export const ORIGIN = 'http://localhost:3000';
export const ADMIN_EMAIL = 'admin@teste.local';
export const ADMIN_PASSWORD = 'SenhaAdmin#2026!';
export const ADMIN_MFA_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

export interface TestContext {
  app: INestApplication;
  server: ReturnType<INestApplication['getHttpServer']>;
  db: DatabaseService;
}

export async function startApp(): Promise<TestContext> {
  const { createApp } = await import('../src/main');
  const app = await createApp({ logger: false });
  await app.init();
  const db = app.get(DatabaseService);
  await runMigrations(db.db);
  return { app, server: app.getHttpServer(), db };
}

export async function resetDatabase(ctx: TestContext): Promise<void> {
  const tables = await ctx.db.client<
    { tablename: string }[]
  >`select tablename from pg_tables where schemaname = 'public'`;
  const names = tables.map((t) => `"${t.tablename}"`).join(', ');
  if (names) await ctx.db.client.unsafe(`truncate table ${names} restart identity cascade`);
  await ctx.db.client`alter sequence order_number_seq restart with 1001`;
  await seed(ctx.db.db, {
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
    adminMfaSecret: ADMIN_MFA_SECRET,
    encryptionKey: process.env.APP_ENCRYPTION_KEY,
  });
}

/** Agente HTTP que mantém cookies e envia a origem permitida (anti-CSRF). */
export function agent(ctx: TestContext) {
  const a = request.agent(ctx.server);
  const withOrigin = (t: SupertestTest) =>
    t.set('Origin', ORIGIN).set('Accept', 'application/json');
  return {
    get: (url: string) => withOrigin(a.get(url)),
    post: (url: string, body?: unknown) => withOrigin(a.post(url)).send(body ?? {}),
    put: (url: string, body?: unknown) => withOrigin(a.put(url)).send(body ?? {}),
    patch: (url: string, body?: unknown) => withOrigin(a.patch(url)).send(body ?? {}),
    delete: (url: string) => withOrigin(a.delete(url)),
  };
}

export type Agent = ReturnType<typeof agent>;

export async function loginAdmin(ctx: TestContext): Promise<Agent> {
  const admin = agent(ctx);
  const login = await admin.post('/api/v1/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (login.status !== 200)
    throw new Error(`login admin falhou: ${login.status} ${JSON.stringify(login.body)}`);
  const verify = await admin.post('/api/v1/auth/mfa/verify', {
    code: authenticator.generate(ADMIN_MFA_SECRET),
  });
  if (verify.status !== 200)
    throw new Error(`mfa admin falhou: ${verify.status} ${JSON.stringify(verify.body)}`);
  return admin;
}

export async function firstVariants(
  ctx: TestContext,
  count = 2,
): Promise<Array<{ id: string; availableQuantity: number; priceCents: number }>> {
  const anon = agent(ctx);
  const list = await anon.get('/api/v1/catalog/products?pageSize=10');
  const out: Array<{ id: string; availableQuantity: number; priceCents: number }> = [];
  for (const item of list.body.items) {
    const detail = await anon.get(`/api/v1/catalog/products/${item.slug}`);
    for (const v of detail.body.product.variants) {
      if (v.inStock)
        out.push({ id: v.id, availableQuantity: v.availableQuantity, priceCents: v.priceCents });
      if (out.length >= count) return out;
    }
  }
  return out;
}

export const VALID_ADDRESS = {
  cep: '01310100',
  street: 'Av. Paulista',
  number: '1000',
  district: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
};

export const VALID_CUSTOMER = {
  name: 'Cliente de Teste',
  email: 'cliente@teste.local',
  phone: '11912345678',
  cpf: '52998224725',
};
