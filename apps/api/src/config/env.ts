import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

/**
 * Configuração 12-factor: tudo vem de variáveis de ambiente, validadas na inicialização.
 * Em produção, valores obrigatórios ausentes derrubam o processo com uma mensagem clara.
 */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.string().min(1).default('postgres://vellor:vellor@localhost:5432/vellor_dev'),
    RUN_MIGRATIONS: z.stringbool().default(false),

    /** URL pública da loja (links em e-mails, redirecionamentos, origem permitida). */
    APP_URL: z.url().default('http://localhost:3000'),
    /** URL pública da API quando diferente da loja (uploads locais usam esta base). */
    API_PUBLIC_URL: z.url().optional(),
    /** Origens extras permitidas para chamadas com cookie, separadas por vírgula. */
    ALLOWED_ORIGINS: z.string().optional(),
    TRUST_PROXY: z.stringbool().optional(),
    COOKIE_SECURE: z.stringbool().optional(),
    COOKIE_DOMAIN: z.string().optional(),

    /** Chave para criptografia em repouso (AES-256-GCM) de segredos MFA e CPF. Mínimo 32 caracteres. */
    APP_ENCRYPTION_KEY: z.string().min(32).optional(),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),

    /** Usados apenas pelo seed para criar o primeiro administrador. */
    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().min(10).optional(),
    ADMIN_NAME: z.string().optional(),
    /** Só para testes automatizados: pré-ativa o MFA do admin com este segredo (ignorado em produção). */
    ADMIN_MFA_SECRET: z.string().min(16).optional(),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./uploads'),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_PUBLIC_URL: z.url().optional(),
    S3_FORCE_PATH_STYLE: z.stringbool().default(true),

    /** Asaas: sem chave, a API roda em modo simulado (PAYMENTS_MOCK). */
    ASAAS_API_KEY: z.string().optional(),
    ASAAS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
    ASAAS_API_URL: z.url().optional(),
    ASAAS_WEBHOOK_TOKEN: z.string().optional(),
    PAYMENTS_MOCK: z.stringbool().default(false),

    /** Correios (API oficial, exige contrato). Sem credenciais, usa a tabela de contingência. */
    CORREIOS_USER: z.string().optional(),
    CORREIOS_ACCESS_CODE: z.string().optional(),
    CORREIOS_POSTAGE_CARD: z.string().optional(),
    CORREIOS_API_URL: z.url().default('https://api.correios.com.br'),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: z.stringbool().default(false),
    MAIL_FROM: z.string().default('Vellor <no-reply@vellor.com.br>'),

    SENTRY_DSN: z.string().optional(),
    METRICS_TOKEN: z.string().optional(),
    OUTBOX_POLL_MS: z.coerce.number().int().min(500).default(5000),
    SWAGGER_ENABLED: z.stringbool().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (!env.APP_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_ENCRYPTION_KEY'],
        message: 'Obrigatória em produção',
      });
    }
    if (!env.ASAAS_API_KEY && !env.PAYMENTS_MOCK) {
      ctx.addIssue({
        code: 'custom',
        path: ['ASAAS_API_KEY'],
        message: 'Obrigatória em produção (ou defina PAYMENTS_MOCK=true explicitamente)',
      });
    }
    if (env.ASAAS_API_KEY && !env.ASAAS_WEBHOOK_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        path: ['ASAAS_WEBHOOK_TOKEN'],
        message: 'Obrigatório quando o Asaas está configurado (autentica os webhooks)',
      });
    }
    if (
      env.STORAGE_DRIVER === 's3' &&
      (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_BUCKET'],
        message: 'Configure S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

const DEV_ENCRYPTION_KEY = 'dev-only-encryption-key-change-me-0123456789';

export function loadEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): Env {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../../.env'),
  ];
  for (const file of candidates) {
    dotenv.config({ path: file, override: false, quiet: true } as dotenv.DotenvConfigOptions);
  }
  const raw = { ...process.env, ...overrides };
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${problems}`);
  }
  const env = parsed.data;
  if (!env.APP_ENCRYPTION_KEY) {
    env.APP_ENCRYPTION_KEY = DEV_ENCRYPTION_KEY;
  }
  return env;
}
