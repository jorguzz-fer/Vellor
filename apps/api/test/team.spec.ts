import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL,
  agent,
  loginAdmin,
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

const tokenFrom = (setupUrl: string) => new URL(setupUrl).searchParams.get('token') ?? '';

describe('equipe do painel', () => {
  it('convida por link: a pessoa define a própria senha e precisa ativar o MFA', async () => {
    const admin = await loginAdmin(ctx);
    const invite = await admin.post('/api/v1/admin/team/invites', {
      name: 'Kleber',
      email: 'Kleber@Teste.local',
    });
    expect(invite.status).toBe(201);
    expect(invite.body.member.email).toBe('kleber@teste.local');
    expect(invite.body.member.invitePending).toBe(true);
    expect(invite.body.promoted).toBe(false);
    expect(invite.body.setupUrl).toContain('/admin/definir-senha?token=');

    // Reenviar para quem ainda não entrou só renova o link
    const resent = await admin.post('/api/v1/admin/team/invites', {
      name: 'Kleber',
      email: 'kleber@teste.local',
    });
    expect(resent.status).toBe(201);
    expect(resent.body.setupUrl).not.toBe(invite.body.setupUrl);

    const list = await admin.get('/api/v1/admin/team');
    expect(list.status).toBe(200);
    expect(list.body.map((m: { email: string }) => m.email)).toEqual([
      ADMIN_EMAIL,
      'kleber@teste.local',
    ]);

    const kleber = agent(ctx);
    const reset = await kleber.post('/api/v1/auth/reset-password', {
      token: tokenFrom(resent.body.setupUrl),
      password: 'SenhaDoKleber#2026',
    });
    expect(reset.status).toBe(200);

    const login = await kleber.post('/api/v1/auth/login', {
      email: 'kleber@teste.local',
      password: 'SenhaDoKleber#2026',
    });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('admin');
    expect(login.body.mfaSetupRequired).toBe(true);

    const blocked = await kleber.get('/api/v1/admin/team');
    expect([401, 403]).toContain(blocked.status);

    // Depois do primeiro acesso, um novo convite para o mesmo e-mail é recusado
    const again = await admin.post('/api/v1/admin/team/invites', {
      name: 'Kleber',
      email: 'kleber@teste.local',
    });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('already_admin');
  });

  it('promove cliente existente, redefine MFA e remove acesso com as proteções', async () => {
    const customer = agent(ctx);
    await customer.post('/api/v1/auth/register', {
      name: 'Ana',
      email: 'ana@teste.local',
      password: 'SenhaForte#2026',
      acceptTerms: true,
    });

    const admin = await loginAdmin(ctx);
    const promote = await admin.post('/api/v1/admin/team/invites', {
      name: 'Ana',
      email: 'ana@teste.local',
    });
    expect(promote.status).toBe(201);
    expect(promote.body.promoted).toBe(true);
    const anaId = promote.body.member.id as string;

    // A sessão antiga de cliente cai: o acesso ao painel exige novo login com MFA
    const staleSession = await customer.get('/api/v1/auth/me');
    expect(staleSession.body.authenticated).toBe(false);

    const me = await admin.get('/api/v1/auth/me');
    const selfId = me.body.user.id as string;

    const revokeSelf = await admin.delete(`/api/v1/admin/team/${selfId}`);
    expect(revokeSelf.status).toBe(422);
    expect(revokeSelf.body.code).toBe('cannot_revoke_self');

    const ownMfa = await admin.post(`/api/v1/admin/team/${selfId}/reset-mfa`);
    expect(ownMfa.status).toBe(422);
    expect(ownMfa.body.code).toBe('cannot_reset_own_mfa');

    const resetMfa = await admin.post(`/api/v1/admin/team/${anaId}/reset-mfa`);
    expect(resetMfa.status).toBe(200);

    const revoke = await admin.delete(`/api/v1/admin/team/${anaId}`);
    expect(revoke.status).toBe(200);
    const list = await admin.get('/api/v1/admin/team');
    expect(list.body).toHaveLength(1);

    const anaLogin = await agent(ctx).post('/api/v1/auth/login', {
      email: 'ana@teste.local',
      password: 'SenhaForte#2026',
    });
    expect(anaLogin.status).toBe(200);
    expect(anaLogin.body.user.role).toBe('customer');

    const missing = await admin.delete('/api/v1/admin/team/00000000-0000-0000-0000-000000000000');
    expect(missing.status).toBe(404);
    const invalid = await admin.delete('/api/v1/admin/team/nao-e-uuid');
    expect(invalid.status).toBe(404);

    const audit = await admin.get('/api/v1/admin/audit-logs?entity=user&pageSize=50');
    const actions = audit.body.items.map((e: { action: string }) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(['team.promoted', 'team.mfa_reset', 'team.revoked']),
    );
  });
});
