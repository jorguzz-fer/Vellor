import { Injectable } from '@nestjs/common';
import { type Coupon, type CouponInput, percentOf } from '@vellor/shared';
import { and, count, desc, eq, ne } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/db-errors';
import { ConflictError, NotFoundError, UnprocessableError } from '../../common/errors';
import { type Database, type DbExecutor, InjectDb } from '../../database/database.module';
import { coupons, orders } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';

type CouponRow = typeof coupons.$inferSelect;

export type CouponValidation =
  | { valid: true; coupon: CouponRow; discountCents: number; description: string }
  | { valid: false; message: string };

@Injectable()
export class CouponsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  describe(row: CouponRow): string {
    return row.type === 'percent'
      ? `${row.value}% de desconto`
      : `R$ ${(row.value / 100).toFixed(2).replace('.', ',')} de desconto`;
  }

  async validate(
    code: string,
    subtotalCents: number,
    customerEmail?: string | null,
    executor: DbExecutor = this.db,
  ): Promise<CouponValidation> {
    const normalized = code.trim().toUpperCase();
    const row = await executor.query.coupons.findFirst({ where: eq(coupons.code, normalized) });
    if (!row || !row.isActive) return { valid: false, message: 'Cupom inválido' };
    const now = Date.now();
    if (row.startsAt && row.startsAt.getTime() > now)
      return { valid: false, message: 'Este cupom ainda não está ativo' };
    if (row.endsAt && row.endsAt.getTime() < now)
      return { valid: false, message: 'Este cupom expirou' };
    if (row.maxUses !== null && row.usesCount >= row.maxUses)
      return { valid: false, message: 'Este cupom atingiu o limite de usos' };
    if (subtotalCents < row.minSubtotalCents) {
      return {
        valid: false,
        message: `Este cupom vale para compras a partir de R$ ${(row.minSubtotalCents / 100).toFixed(2).replace('.', ',')}`,
      };
    }
    if (row.maxUsesPerCustomer !== null && customerEmail) {
      const [{ n }] = await executor
        .select({ n: count() })
        .from(orders)
        .where(
          and(
            eq(orders.couponId, row.id),
            eq(orders.customerEmail, customerEmail.toLowerCase()),
            ne(orders.status, 'cancelled'),
          ),
        );
      if (Number(n) >= row.maxUsesPerCustomer)
        return { valid: false, message: 'Você já utilizou este cupom' };
    }
    const discountCents =
      row.type === 'percent'
        ? percentOf(subtotalCents, row.value)
        : Math.min(row.value, subtotalCents);
    return { valid: true, coupon: row, discountCents, description: this.describe(row) };
  }

  /** Consome um uso do cupom dentro da transação do pedido (com lock para respeitar maxUses). */
  async consume(couponId: string, tx: DbExecutor): Promise<void> {
    const [row] = await tx.select().from(coupons).where(eq(coupons.id, couponId)).for('update');
    if (!row) throw new UnprocessableError('Cupom inválido', 'invalid_coupon');
    if (row.maxUses !== null && row.usesCount >= row.maxUses)
      throw new UnprocessableError('Este cupom atingiu o limite de usos', 'coupon_exhausted');
    await tx
      .update(coupons)
      .set({ usesCount: row.usesCount + 1, updatedAt: new Date() })
      .where(eq(coupons.id, couponId));
  }

  // ---------- Admin ----------

  toCoupon(row: CouponRow): Coupon {
    return {
      id: row.id,
      code: row.code,
      description: row.description,
      type: row.type,
      value: row.value,
      minSubtotalCents: row.minSubtotalCents,
      maxUses: row.maxUses,
      maxUsesPerCustomer: row.maxUsesPerCustomer,
      usesCount: row.usesCount,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(): Promise<Coupon[]> {
    const rows = await this.db.query.coupons.findMany({ orderBy: [desc(coupons.createdAt)] });
    return rows.map((r) => this.toCoupon(r));
  }

  private columns(input: CouponInput) {
    return {
      code: input.code,
      description: input.description ?? null,
      type: input.type,
      value: input.value,
      minSubtotalCents: input.minSubtotalCents,
      maxUses: input.maxUses ?? null,
      maxUsesPerCustomer: input.maxUsesPerCustomer ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      isActive: input.isActive,
      updatedAt: new Date(),
    };
  }

  async create(input: CouponInput, actor: AuthUser, ip?: string): Promise<Coupon> {
    try {
      const [row] = await this.db.insert(coupons).values(this.columns(input)).returning();
      await this.audit.record({
        actor,
        action: 'coupon.create',
        entity: 'coupon',
        entityId: row!.id,
        summary: input.code,
        ip,
      });
      return this.toCoupon(row!);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictError('Já existe um cupom com este código', 'coupon_code_in_use');
      throw error;
    }
  }

  async update(id: string, input: CouponInput, actor: AuthUser, ip?: string): Promise<Coupon> {
    try {
      const [row] = await this.db
        .update(coupons)
        .set(this.columns(input))
        .where(eq(coupons.id, id))
        .returning();
      if (!row) throw new NotFoundError('Cupom não encontrado', 'coupon_not_found');
      await this.audit.record({
        actor,
        action: 'coupon.update',
        entity: 'coupon',
        entityId: id,
        summary: input.code,
        ip,
      });
      return this.toCoupon(row);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictError('Já existe um cupom com este código', 'coupon_code_in_use');
      throw error;
    }
  }

  async remove(id: string, actor: AuthUser, ip?: string): Promise<void> {
    const [row] = await this.db
      .update(coupons)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      .returning();
    if (!row) throw new NotFoundError('Cupom não encontrado', 'coupon_not_found');
    await this.audit.record({
      actor,
      action: 'coupon.deactivate',
      entity: 'coupon',
      entityId: id,
      summary: row.code,
      ip,
    });
  }
}
