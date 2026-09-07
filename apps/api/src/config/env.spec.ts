import { describe, expect, it, vi } from 'vitest';
import { loadEnv } from './env';

// Sem arquivos .env: o teste depende só das variáveis passadas explicitamente.
vi.mock('dotenv', () => ({ default: { config: () => ({}) } }));

describe('loadEnv', () => {
  it('trata variáveis vazias como não definidas (painéis como o Coolify gravam "")', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      S3_ENDPOINT: '',
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: '',
      COOKIE_DOMAIN: '',
      LOG_LEVEL: '',
    });
    expect(env.S3_ENDPOINT).toBeUndefined();
    expect(env.ADMIN_EMAIL).toBeUndefined();
    expect(env.ADMIN_PASSWORD).toBeUndefined();
    expect(env.COOKIE_DOMAIN).toBeUndefined();
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('em produção exige a chave de cifragem e a chave do Asaas', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        APP_ENCRYPTION_KEY: '',
        ASAAS_API_KEY: '',
        PAYMENTS_MOCK: '',
      }),
    ).toThrow(/APP_ENCRYPTION_KEY[\s\S]*ASAAS_API_KEY/);
  });

  it('em produção exige o token do webhook quando o Asaas está configurado', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        APP_ENCRYPTION_KEY: 'x'.repeat(32),
        ASAAS_API_KEY: 'chave',
        ASAAS_WEBHOOK_TOKEN: '',
      }),
    ).toThrow(/ASAAS_WEBHOOK_TOKEN/);
    const env = loadEnv({
      NODE_ENV: 'production',
      APP_ENCRYPTION_KEY: 'x'.repeat(32),
      ASAAS_API_KEY: 'chave',
      ASAAS_WEBHOOK_TOKEN: 'token',
    });
    expect(env.ASAAS_ENV).toBe('sandbox');
  });
});
