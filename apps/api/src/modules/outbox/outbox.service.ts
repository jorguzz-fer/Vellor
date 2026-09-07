import { Injectable } from '@nestjs/common';
import { and, asc, eq, lte, sql } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { type Database, type DbExecutor, InjectDb } from '../../database/database.module';
import { outboxEvents } from '../../database/schema';
import { MetricsService } from '../../health/metrics.service';

export type OutboxHandler = (payload: Record<string, unknown>) => Promise<void>;

const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 10;

/**
 * Outbox transacional: efeitos colaterais (e-mails, notificações) são gravados no banco
 * junto com a transação de negócio e processados depois com retry, back-off e dead-letter.
 */
@Injectable()
export class OutboxService {
  private readonly handlers = new Map<string, OutboxHandler>();

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {
    this.logger.setContext(OutboxService.name);
  }

  register(type: string, handler: OutboxHandler): void {
    this.handlers.set(type, handler);
  }

  async enqueue(
    type: string,
    payload: Record<string, unknown>,
    executor: DbExecutor = this.db,
  ): Promise<void> {
    await executor.insert(outboxEvents).values({ type, payload });
  }

  /** Processa um lote de eventos pendentes. Seguro para múltiplas instâncias (SKIP LOCKED). */
  async processBatch(): Promise<number> {
    const claimed = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: outboxEvents.id })
        .from(outboxEvents)
        .where(and(eq(outboxEvents.status, 'pending'), lte(outboxEvents.nextAttemptAt, new Date())))
        .orderBy(asc(outboxEvents.createdAt))
        .limit(BATCH_SIZE)
        .for('update', { skipLocked: true });
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.id);
      return tx
        .update(outboxEvents)
        .set({ status: 'processing' })
        .where(sql`${outboxEvents.id} in ${ids}`)
        .returning();
    });

    for (const event of claimed) {
      const handler = this.handlers.get(event.type);
      try {
        if (!handler) throw new Error(`Nenhum handler registrado para "${event.type}"`);
        await handler(event.payload);
        await this.db
          .update(outboxEvents)
          .set({
            status: 'done',
            processedAt: new Date(),
            attempts: event.attempts + 1,
            lastError: null,
          })
          .where(eq(outboxEvents.id, event.id));
      } catch (error) {
        const attempts = event.attempts + 1;
        const dead = attempts >= MAX_ATTEMPTS;
        const delayMs = Math.min(60 * 60 * 1000, 10_000 * 2 ** attempts);
        this.metrics.outboxFailures.inc({ type: event.type });
        this.logger.warn(
          { err: error, eventId: event.id, type: event.type, attempts, dead },
          'Falha ao processar evento do outbox',
        );
        await this.db
          .update(outboxEvents)
          .set({
            status: dead ? 'dead' : 'pending',
            attempts,
            nextAttemptAt: new Date(Date.now() + delayMs),
            lastError: error instanceof Error ? error.message.slice(0, 1000) : String(error),
          })
          .where(eq(outboxEvents.id, event.id));
      }
    }
    return claimed.length;
  }
}
