import { Injectable } from '@nestjs/common';
import type { AuditLog, Paginated } from '@vellor/shared';
import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { type Database, type DbExecutor, InjectDb } from '../../database/database.module';
import { auditLogs } from '../../database/schema';
import type { AuthUser } from '../auth/auth.types';

export interface AuditEntry {
  actor?: AuthUser | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string | null;
  data?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/** Trilha de auditoria imutável: quem fez o quê, quando e de onde. Nunca é apagada pela aplicação. */
@Injectable()
export class AuditService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditService.name);
  }

  async record(entry: AuditEntry, executor: DbExecutor = this.db): Promise<void> {
    try {
      await executor.insert(auditLogs).values({
        actorId: entry.actor?.id ?? null,
        actorEmail: entry.actor?.email ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary ?? null,
        data: entry.data ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 300) ?? null,
      });
    } catch (error) {
      this.logger.error(
        { err: error, entry: { action: entry.action, entity: entry.entity } },
        'Falha ao gravar auditoria',
      );
    }
  }

  async list(query: {
    page: number;
    pageSize: number;
    entity?: string;
    actorId?: string;
  }): Promise<Paginated<AuditLog>> {
    const conditions: SQL[] = [];
    if (query.entity) conditions.push(eq(auditLogs.entity, query.entity));
    if (query.actorId) conditions.push(eq(auditLogs.actorId, query.actorId));
    const where = conditions.length ? and(...conditions) : undefined;
    const [{ total }] = await this.db.select({ total: count() }).from(auditLogs).where(where);
    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return {
      items: rows.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorEmail: row.actorEmail,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        summary: row.summary,
        ip: row.ip,
        createdAt: row.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / query.pageSize)),
    };
  }
}
