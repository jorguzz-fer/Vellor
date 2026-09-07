import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { TeamInviteInput, TeamInviteResult, TeamMember } from '@vellor/shared';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ConflictError, NotFoundError, UnprocessableError } from '../../common/errors';
import { AppConfig } from '../../config/app-config';
import { type Database, InjectDb } from '../../database/database.module';
import { passwordResets, users } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { MailService } from '../mail/mail.service';
import { teamInviteTemplate } from '../mail/templates';
import { OutboxService } from '../outbox/outbox.service';

/** Convites valem mais que a redefinição de senha comum (1 h): a pessoa pode não ler na hora. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UserRow = typeof users.$inferSelect;

function toMember(row: UserRow): TeamMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mfaEnabled: row.mfaEnabledAt !== null,
    invitePending: row.lastLoginAt === null,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Equipe do painel: quem administra a loja. Ninguém recebe senha temporária: o convite gera um
 * link (mesmo mecanismo da redefinição de senha) e a própria pessoa define a senha; o MFA é
 * exigido no primeiro acesso. Toda ação fica na trilha de auditoria.
 */
@Injectable()
export class TeamService implements OnModuleInit {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly crypto: CryptoService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly mail: MailService,
  ) {}

  onModuleInit(): void {
    this.outbox.register('email.team_invite', async (payload) => {
      const ctx = await this.mail.context();
      await this.mail.send({
        to: String(payload.to),
        ...teamInviteTemplate(
          ctx,
          String(payload.name),
          String(payload.link),
          String(payload.invitedBy),
        ),
      });
    });
  }

  async list(): Promise<TeamMember[]> {
    const rows = await this.db.query.users.findMany({
      where: and(eq(users.role, 'admin'), isNull(users.deletedAt)),
      orderBy: [asc(users.createdAt)],
    });
    return rows.map(toMember);
  }

  /**
   * Convida um administrador: cria a conta ou promove um cliente existente, e gera o link para
   * definir a senha. Repetir o convite de quem ainda não entrou apenas renova o link.
   */
  async invite(
    input: TeamInviteInput,
    actor: AuthUser,
    ip?: string | null,
  ): Promise<TeamInviteResult> {
    const existing = await this.db.query.users.findFirst({
      where: and(eq(users.email, input.email), isNull(users.deletedAt)),
    });
    let row: UserRow;
    let action: 'team.invited' | 'team.invite_resent' | 'team.promoted';
    if (!existing) {
      // Senha aleatória que ninguém conhece: o acesso só nasce pelo link de definição de senha.
      const passwordHash = await this.passwords.hash(this.crypto.randomToken(32));
      [row] = (await this.db
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          passwordHash,
          role: 'admin',
          emailVerifiedAt: new Date(),
        })
        .returning()) as [UserRow];
      action = 'team.invited';
    } else if (existing.role !== 'admin') {
      [row] = (await this.db
        .update(users)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning()) as [UserRow];
      // Sessões de cliente não passaram pelo MFA: derruba tudo e exige novo login como admin.
      await this.sessions.revokeAllForUser(existing.id);
      action = 'team.promoted';
    } else if (existing.lastLoginAt === null) {
      row = existing;
      action = 'team.invite_resent';
    } else {
      throw new ConflictError('Este e-mail já é de um administrador ativo', 'already_admin');
    }

    const token = this.crypto.randomToken(32);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.db.insert(passwordResets).values({
      userId: row.id,
      tokenHash: this.crypto.sha256(token),
      expiresAt,
    });
    const setupUrl = `${this.config.env.APP_URL}/admin/definir-senha?token=${encodeURIComponent(token)}`;
    await this.outbox.enqueue('email.team_invite', {
      to: row.email,
      name: row.name,
      link: setupUrl,
      invitedBy: actor.name,
    });
    await this.audit.record({
      actor,
      action,
      entity: 'user',
      entityId: row.id,
      ip,
      summary: row.email,
    });
    return {
      member: toMember(row),
      setupUrl,
      expiresAt: expiresAt.toISOString(),
      emailQueued: this.mail.configured,
      promoted: action === 'team.promoted',
    };
  }

  /** Tira o acesso administrativo: a conta volta a ser de cliente e as sessões caem. */
  async revoke(id: string, actor: AuthUser, ip?: string | null): Promise<void> {
    if (id === actor.id)
      throw new UnprocessableError(
        'Você não pode remover o seu próprio acesso',
        'cannot_revoke_self',
      );
    const row = await this.findAdmin(id);
    const [{ total }] = (await this.db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)))) as [{ total: number }];
    if (Number(total) <= 1)
      throw new UnprocessableError('A loja precisa de pelo menos um administrador', 'last_admin');
    await this.db
      .update(users)
      .set({
        role: 'customer',
        mfaSecretEncrypted: null,
        mfaEnabledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, row.id));
    await this.sessions.revokeAllForUser(row.id);
    await this.audit.record({
      actor,
      action: 'team.revoked',
      entity: 'user',
      entityId: row.id,
      ip,
      summary: row.email,
    });
  }

  /** Remove o segundo fator (celular perdido, app trocado): a pessoa configura de novo ao entrar. */
  async resetMfa(id: string, actor: AuthUser, ip?: string | null): Promise<void> {
    if (id === actor.id)
      throw new UnprocessableError(
        'Peça a outro administrador para redefinir o seu segundo fator',
        'cannot_reset_own_mfa',
      );
    const row = await this.findAdmin(id);
    await this.db
      .update(users)
      .set({ mfaSecretEncrypted: null, mfaEnabledAt: null, updatedAt: new Date() })
      .where(eq(users.id, row.id));
    await this.sessions.revokeAllForUser(row.id);
    await this.audit.record({
      actor,
      action: 'team.mfa_reset',
      entity: 'user',
      entityId: row.id,
      ip,
      summary: row.email,
    });
  }

  private async findAdmin(id: string): Promise<UserRow> {
    const row = UUID_RE.test(id)
      ? await this.db.query.users.findFirst({
          where: and(eq(users.id, id), eq(users.role, 'admin'), isNull(users.deletedAt)),
        })
      : undefined;
    if (!row) throw new NotFoundError('Administrador não encontrado', 'admin_not_found');
    return row;
  }
}
