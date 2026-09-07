import { authenticator } from 'otplib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL,
  ADMIN_MFA_SECRET,
  ADMIN_PASSWORD,
  agent,
  resetDatabase,
  startApp,
  type TestContext,
} from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startApp();
});

afterAll(async () => {
  await ctx.app.close();
});

beforeEach(async () => {
  await resetDatabase(ctx);
});

describe('autenticação de clientes', () => {
  it('cadastra, mantém sessão por cookie e impede e-mail duplicado', async () => {
    const customer = agent(ctx);
    const register = await customer.post('/api/v1/auth/register', {
      name: 'Maria Teste',
      email: 'maria@teste.local',
      password: 'SenhaForte#2026',
      acceptTerms: true,
    });
    expect(register.status).toBe(201);
    expect(register.body.user.role).toBe('customer');
    expect(register.headers['set-cookie']?.[0]).toMatch(/vellor_sid=.*HttpOnly/);

    const me = await customer.get('/api/v1/auth/me');
    expect(me.body.authenticated).toBe(true);

    const dup = await agent(ctx).post('/api/v1/auth/register', {
      name: 'Outra',
      email: 'MARIA@teste.local',
      password: 'SenhaForte#2026',
      acceptTerms: true,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('email_in_use');

    await customer.post('/api/v1/auth/logout');
    const after = await customer.get('/api/v1/auth/me');
    expect(after.body.authenticated).toBe(false);
  });

  it('rejeita requisições mutáveis de origens desconhecidas', async () => {
    const res = await agent(ctx)
      .post('/api/v1/newsletter', { email: 'a@b.com', consent: true })
      .set('Origin', 'https://malicioso.example');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('origin_not_allowed');
  });

  it('bloqueia a conta após tentativas incorretas', async () => {
    await agent(ctx).post('/api/v1/auth/register', {
      name: 'João',
      email: 'joao@teste.local',
      password: 'SenhaForte#2026',
      acceptTerms: true,
    });
    for (let i = 0; i < 5; i++) {
      const res = await agent(ctx).post('/api/v1/auth/login', {
        email: 'joao@teste.local',
        password: 'errada-errada',
      });
      expect(res.status).toBe(401);
    }
    const locked = await agent(ctx).post('/api/v1/auth/login', {
      email: 'joao@teste.local',
      password: 'SenhaForte#2026',
    });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('account_locked');
  });

  it('não revela se um e-mail existe na recuperação de senha', async () => {
    const res = await agent(ctx).post('/api/v1/auth/forgot-password', {
      email: 'ninguem@teste.local',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('administrador e MFA', () => {
  it('exige o segundo fator antes de liberar o painel', async () => {
    const admin = agent(ctx);
    const login = await admin.post('/api/v1/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    expect(login.status).toBe(200);
    expect(login.body.mfaPending).toBe(true);

    const blocked = await admin.get('/api/v1/admin/dashboard');
    expect(blocked.status).toBe(401);
    expect(blocked.body.code).toBe('mfa_required');

    const wrong = await admin.post('/api/v1/auth/mfa/verify', { code: '000000' });
    expect(wrong.status).toBe(401);

    const ok = await admin.post('/api/v1/auth/mfa/verify', {
      code: authenticator.generate(ADMIN_MFA_SECRET),
    });
    expect(ok.status).toBe(200);
    expect(ok.body.user.mfaVerified).toBe(true);

    const dashboard = await admin.get('/api/v1/admin/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.ordersByStatus).toBeDefined();
  });

  it('clientes não acessam rotas administrativas', async () => {
    const customer = agent(ctx);
    await customer.post('/api/v1/auth/register', {
      name: 'Ana',
      email: 'ana@teste.local',
      password: 'SenhaForte#2026',
      acceptTerms: true,
    });
    const res = await customer.get('/api/v1/admin/orders');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('admin_only');
  });
});
