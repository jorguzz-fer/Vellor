import { Injectable } from '@nestjs/common';
import type { UserRole } from '@vellor/shared';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import type { CookieOptions, Response } from 'express';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppConfig } from '../../config/app-config';
import { type Database, InjectDb } from '../../database/database.module';
import { sessions, users } from '../../database/schema';
import { SESSION_COOKIE } from '../../openapi';
import type { AuthContext, AuthUser } from './auth.types';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function toAuthUser(row: typeof users.$inferSelect): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    phone: row.phone,
    cpfMasked: row.cpfMasked,
    mfaEnabled: row.mfaEnabledAt !== null,
    newsletterOptIn: row.newsletterOptIn,
    providerCustomerId: row.providerCustomerId,
    createdAt: row.createdAt,
  };
}

/** Sessões server-side: o cookie carrega apenas um token opaco; o banco guarda o hash. */
@Injectable()
export class SessionService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly config: AppConfig,
  ) {}

  ttlMs(role: UserRole): number {
    return role === 'admin'
      ? this.config.env.ADMIN_SESSION_TTL_HOURS * 3_600_000
      : this.config.env.SESSION_TTL_DAYS * 86_400_000;
  }

  async create(
    userId: string,
    role: UserRole,
    meta: { ip?: string | null; userAgent?: string | null; mfaVerified: boolean },
  ): Promise<{ token: string; id: string; expiresAt: Date }> {
    const token = this.crypto.randomToken(32);
    const expiresAt = new Date(Date.now() + this.ttlMs(role));
    const [row] = await this.db
      .insert(sessions)
      .values({
        userId,
        tokenHash: this.crypto.sha256(token),
        expiresAt,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        mfaVerifiedAt: meta.mfaVerified ? new Date() : null,
      })
      .returning({ id: sessions.id });
    return { token, id: row!.id, expiresAt };
  }

  async resolve(token: string): Promise<AuthContext | null> {
    const tokenHash = this.crypto.sha256(token);
    const rows = await this.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    const found = rows[0];
    if (!found) return null;

    if (Date.now() - found.session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      void this.db
        .update(sessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(sessions.id, found.session.id))
        .catch(() => undefined);
    }

    return {
      user: toAuthUser(found.user),
      session: {
        id: found.session.id,
        mfaVerified: found.session.mfaVerifiedAt !== null,
        expiresAt: found.session.expiresAt,
      },
    };
  }

  async markMfaVerified(sessionId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ mfaVerifiedAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
    if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(...conditions));
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      domain: this.config.env.COOKIE_DOMAIN,
    };
  }

  setCookie(res: Response, token: string, role: UserRole): void {
    res.cookie(SESSION_COOKIE, token, { ...this.baseCookieOptions(), maxAge: this.ttlMs(role) });
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.baseCookieOptions());
  }
}
