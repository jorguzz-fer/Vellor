import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  type AuthStatus,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  maskCPF,
  type Me,
  type MfaSetupResponse,
  type RegisterInput,
  type ResetPasswordInput,
  type UpdateProfileInput,
} from '@vellor/shared';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { CryptoService } from '../../common/crypto/crypto.service';
import { isUniqueViolation } from '../../common/db-errors';
import {
  ConflictError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableError,
} from '../../common/errors';
import { AppConfig } from '../../config/app-config';
import { type Database, InjectDb } from '../../database/database.module';
import { passwordResets, users } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { passwordResetTemplate, welcomeTemplate } from '../mail/templates';
import { OutboxService } from '../outbox/outbox.service';
import type { AuthContext, AuthUser } from './auth.types';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { SessionService, toAuthUser } from './session.service';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface LoginResult {
  status: AuthStatus;
  token: string;
  role: AuthUser['role'];
}

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCK_MINUTES = 15;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordService,
    private readonly mfa: MfaService,
    private readonly crypto: CryptoService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly mail: MailService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  onModuleInit(): void {
    this.outbox.register('email.welcome', async (payload) => {
      const ctx = await this.mail.context();
      await this.mail.send({
        to: String(payload.to),
        ...welcomeTemplate(ctx, String(payload.name)),
      });
    });
    this.outbox.register('email.password_reset', async (payload) => {
      const ctx = await this.mail.context();
      await this.mail.send({
        to: String(payload.to),
        ...passwordResetTemplate(ctx, String(payload.name), String(payload.link)),
      });
    });
  }

  status(auth?: AuthContext): AuthStatus {
    if (!auth)
      return { authenticated: false, user: null, mfaSetupRequired: false, mfaPending: false };
    const isAdmin = auth.user.role === 'admin';
    return {
      authenticated: true,
      user: this.toMe(auth),
      mfaSetupRequired: isAdmin && !auth.user.mfaEnabled,
      mfaPending: isAdmin && auth.user.mfaEnabled && !auth.session.mfaVerified,
    };
  }

  toMe(auth: AuthContext): Me {
    return {
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
      role: auth.user.role,
      phone: auth.user.phone,
      cpfMasked: auth.user.cpfMasked,
      mfaEnabled: auth.user.mfaEnabled,
      mfaVerified: auth.session.mfaVerified,
      newsletterOptIn: auth.user.newsletterOptIn,
      createdAt: auth.user.createdAt.toISOString(),
    };
  }

  async register(input: RegisterInput, meta: RequestMeta): Promise<LoginResult> {
    const passwordHash = await this.passwords.hash(input.password);
    let row: typeof users.$inferSelect;
    try {
      [row] = (await this.db
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          phone: input.phone ?? null,
          passwordHash,
          role: 'customer',
          newsletterOptIn: input.newsletterOptIn ?? false,
          lastLoginAt: new Date(),
        })
        .returning()) as [typeof users.$inferSelect];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          'Já existe uma conta com este e-mail. Faça login ou recupere a senha.',
          'email_in_use',
        );
      }
      throw error;
    }
    const session = await this.sessions.create(row.id, row.role, { ...meta, mfaVerified: true });
    await this.outbox.enqueue('email.welcome', { to: row.email, name: row.name });
    await this.audit.record({
      actor: toAuthUser(row),
      action: 'auth.register',
      entity: 'user',
      entityId: row.id,
      ip: meta.ip,
    });
    const auth: AuthContext = {
      user: toAuthUser(row),
      session: { id: session.id, mfaVerified: true, expiresAt: session.expiresAt },
    };
    return { status: this.status(auth), token: session.token, role: row.role };
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
    const row = await this.db.query.users.findFirst({
      where: and(eq(users.email, input.email), isNull(users.deletedAt)),
    });
    if (!row) {
      await this.passwords.dummyVerify();
      throw new UnauthorizedError('E-mail ou senha inválidos', 'invalid_credentials');
    }
    if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new TooManyRequestsError(
        `Conta temporariamente bloqueada por tentativas incorretas. Tente em ${minutes} min.`,
        'account_locked',
      );
    }

    const valid = await this.passwords.verify(row.passwordHash, input.password);
    if (!valid) {
      const failed = row.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED_ATTEMPTS;
      const lockMinutes = Math.min(
        24 * 60,
        BASE_LOCK_MINUTES * 2 ** (failed - MAX_FAILED_ATTEMPTS),
      );
      await this.db
        .update(users)
        .set({
          failedLoginCount: failed,
          lockedUntil: lock ? new Date(Date.now() + lockMinutes * 60_000) : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, row.id));
      await this.audit.record({
        actor: null,
        action: 'auth.login_failed',
        entity: 'user',
        entityId: row.id,
        ip: meta.ip,
        summary: lock ? `Conta bloqueada por ${lockMinutes} min` : null,
      });
      throw new UnauthorizedError('E-mail ou senha inválidos', 'invalid_credentials');
    }

    await this.db
      .update(users)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, row.id));

    const isAdmin = row.role === 'admin';
    const session = await this.sessions.create(row.id, row.role, {
      ...meta,
      mfaVerified: !isAdmin,
    });
    const auth: AuthContext = {
      user: toAuthUser(row),
      session: { id: session.id, mfaVerified: !isAdmin, expiresAt: session.expiresAt },
    };
    await this.audit.record({
      actor: auth.user,
      action: 'auth.login',
      entity: 'user',
      entityId: row.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { status: this.status(auth), token: session.token, role: row.role };
  }

  async logout(auth: AuthContext | undefined, meta: RequestMeta): Promise<void> {
    if (!auth) return;
    await this.sessions.revoke(auth.session.id);
    await this.audit.record({
      actor: auth.user,
      action: 'auth.logout',
      entity: 'user',
      entityId: auth.user.id,
      ip: meta.ip,
    });
  }

  async forgotPassword(input: ForgotPasswordInput, meta: RequestMeta): Promise<void> {
    const row = await this.db.query.users.findFirst({
      where: and(eq(users.email, input.email), isNull(users.deletedAt)),
    });
    if (!row) return; // resposta idêntica para não revelar se o e-mail existe
    const token = this.crypto.randomToken(32);
    await this.db.insert(passwordResets).values({
      userId: row.id,
      tokenHash: this.crypto.sha256(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    const link = `${this.config.env.APP_URL}/conta/redefinir-senha?token=${encodeURIComponent(token)}`;
    await this.outbox.enqueue('email.password_reset', { to: row.email, name: row.name, link });
    await this.audit.record({
      actor: null,
      action: 'auth.password_reset_requested',
      entity: 'user',
      entityId: row.id,
      ip: meta.ip,
    });
  }

  async resetPassword(input: ResetPasswordInput, meta: RequestMeta): Promise<void> {
    const tokenHash = this.crypto.sha256(input.token);
    const reset = await this.db.query.passwordResets.findFirst({
      where: and(
        eq(passwordResets.tokenHash, tokenHash),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    });
    if (!reset)
      throw new UnprocessableError(
        'Link inválido ou expirado. Solicite uma nova redefinição.',
        'invalid_reset_token',
      );
    const passwordHash = await this.passwords.hash(input.password);
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() })
        .where(eq(users.id, reset.userId));
      await tx
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(eq(passwordResets.id, reset.id));
    });
    await this.sessions.revokeAllForUser(reset.userId);
    await this.audit.record({
      actor: null,
      action: 'auth.password_reset',
      entity: 'user',
      entityId: reset.userId,
      ip: meta.ip,
    });
  }

  async changePassword(
    auth: AuthContext,
    input: ChangePasswordInput,
    meta: RequestMeta,
  ): Promise<void> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, auth.user.id) });
    if (!row) throw new UnauthorizedError();
    const valid = await this.passwords.verify(row.passwordHash, input.currentPassword);
    if (!valid)
      throw new UnprocessableError('Senha atual incorreta', 'invalid_current_password', {
        currentPassword: ['Senha atual incorreta'],
      });
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, row.id));
    await this.sessions.revokeAllForUser(row.id, auth.session.id);
    await this.audit.record({
      actor: auth.user,
      action: 'auth.password_changed',
      entity: 'user',
      entityId: row.id,
      ip: meta.ip,
    });
  }

  async mfaSetup(auth: AuthContext): Promise<MfaSetupResponse> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, auth.user.id) });
    if (!row) throw new UnauthorizedError();
    if (row.mfaEnabledAt)
      throw new ConflictError('O segundo fator já está ativo nesta conta', 'mfa_already_enabled');
    const secret = this.mfa.generateSecret();
    await this.db
      .update(users)
      .set({ mfaSecretEncrypted: this.crypto.encrypt(secret), updatedAt: new Date() })
      .where(eq(users.id, row.id));
    const otpauthUrl = this.mfa.keyUri(row.email, secret);
    return {
      otpauthUrl,
      qrCodeDataUrl: await this.mfa.qrDataUrl(otpauthUrl),
      secretMasked: `${secret.slice(0, 4)}…${secret.slice(-4)}`,
    };
  }

  async mfaEnable(auth: AuthContext, code: string, meta: RequestMeta): Promise<AuthStatus> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, auth.user.id) });
    if (!row?.mfaSecretEncrypted)
      throw new UnprocessableError(
        'Inicie a configuração do segundo fator primeiro',
        'mfa_not_initialized',
      );
    if (row.mfaEnabledAt)
      throw new ConflictError('O segundo fator já está ativo nesta conta', 'mfa_already_enabled');
    const secret = this.crypto.decrypt(row.mfaSecretEncrypted);
    if (!this.mfa.verify(code, secret))
      throw new UnprocessableError(
        'Código inválido. Confira o horário do celular e tente de novo.',
        'invalid_mfa_code',
        { code: ['Código inválido'] },
      );
    await this.db
      .update(users)
      .set({ mfaEnabledAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, row.id));
    await this.sessions.markMfaVerified(auth.session.id);
    await this.audit.record({
      actor: auth.user,
      action: 'auth.mfa_enabled',
      entity: 'user',
      entityId: row.id,
      ip: meta.ip,
    });
    return this.status({
      user: { ...auth.user, mfaEnabled: true },
      session: { ...auth.session, mfaVerified: true },
    });
  }

  async mfaVerify(auth: AuthContext, code: string, meta: RequestMeta): Promise<AuthStatus> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, auth.user.id) });
    if (!row?.mfaSecretEncrypted || !row.mfaEnabledAt)
      throw new ForbiddenError('Segundo fator não configurado', 'mfa_setup_required');
    const secret = this.crypto.decrypt(row.mfaSecretEncrypted);
    if (!this.mfa.verify(code, secret)) {
      await this.audit.record({
        actor: auth.user,
        action: 'auth.mfa_failed',
        entity: 'user',
        entityId: row.id,
        ip: meta.ip,
      });
      throw new UnauthorizedError('Código inválido', 'invalid_mfa_code');
    }
    await this.sessions.markMfaVerified(auth.session.id);
    await this.audit.record({
      actor: auth.user,
      action: 'auth.mfa_verified',
      entity: 'user',
      entityId: row.id,
      ip: meta.ip,
    });
    return this.status({ user: auth.user, session: { ...auth.session, mfaVerified: true } });
  }

  async updateProfile(auth: AuthContext, input: UpdateProfileInput): Promise<Me> {
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.newsletterOptIn !== undefined) patch.newsletterOptIn = input.newsletterOptIn;
    if (input.cpf !== undefined) {
      patch.cpfEncrypted = this.crypto.encrypt(input.cpf);
      patch.cpfMasked = maskCPF(input.cpf);
    }
    const [row] = await this.db
      .update(users)
      .set(patch)
      .where(eq(users.id, auth.user.id))
      .returning();
    if (!row) throw new UnauthorizedError();
    return this.toMe({ user: toAuthUser(row), session: auth.session });
  }

  /** CPF em claro (uso restrito: emissão de cobrança). */
  async decryptedCpf(userId: string): Promise<string | null> {
    const row = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { cpfEncrypted: true },
    });
    return row?.cpfEncrypted ? this.crypto.decrypt(row.cpfEncrypted) : null;
  }
}
