import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const apiEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'warn',
  PORT: '3001',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://vellor:vellor@localhost:5432/vellor_test',
  APP_ENCRYPTION_KEY: 'e2e-encryption-key-0123456789-abcdefghijklmn',
  PAYMENTS_MOCK: 'true',
  ADMIN_EMAIL: 'admin@e2e.local',
  ADMIN_PASSWORD: 'SenhaAdmin#E2E-2026',
  ADMIN_MFA_SECRET: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  APP_URL: 'http://127.0.0.1:3000',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node dist/database/seed.js && node dist/main.js',
      cwd: '../api',
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: apiEnv,
    },
    {
      command: 'pnpm preview',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: { VITE_API_PROXY: 'http://127.0.0.1:3001' },
    },
  ],
});
