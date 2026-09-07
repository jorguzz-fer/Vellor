import { Inject, Injectable, type OnModuleInit, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  type AdminOrder,
  type AdminOrderQuery,
  type Order,
  type OrderActionInput,
  type OrderSummary,
  ORDER_STATUS_LABELS,
  type Paginated,
  type PaymentStatus,
  type OrderEventType,
} from '@vellor/shared';
import { and, count, desc, eq, gte, ilike, inArray, lt, lte, or, type SQL } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { CryptoService } from '../../common/crypto/crypto.service';
import { NotFoundError, UnprocessableError } from '../../common/errors';
import { AppConfig } from '../../config/app-config';
import { type Database, type DbExecutor, InjectDb } from '../../database/database.module';
import {
  inventoryMovements,
  orderEvents,
  orderItems,
  orders,
  productVariants,
} from '../../database/schema';
import { MetricsService } from '../../health/metrics.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext, AuthUser } from '../auth/auth.types';
import { MailService } from '../mail/mail.service';
import {
  orderCreatedTemplate,
  orderShippedTemplate,
  orderStatusTemplate,
  paymentConfirmedTemplate,
} from '../mail/templates';
import { OutboxService } from '../outbox/outbox.service';
import { PaymentsService } from '../payments/payments.service';

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;
type OrderEventRow = typeof orderEvents.$inferSelect;

export interface OrderWithRelations extends OrderRow {
  items: OrderItemRow[];
  events: OrderEventRow[];
}

export interface ProviderEvent {
  providerPaymentId: string;
  externalReference: string | null;
  status: PaymentStatus;
  event: string;
  paidAt: string | null;
}

const RELATIONS = { items: true, events: true } as const;
const PENDING_EXPIRATION_DAYS = 5;

export function trackingUrlFor(code: string | null): string | null {
  return code
    ? `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(code)}`
    : null;
}

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
    private readonly config: AppConfig,
    @Inject(forwardRef(() => PaymentsService)) private readonly payments: PaymentsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OrdersService.name);
  }

  onModuleInit(): void {
    const register = (
      type: string,
      render: (
        order: Order,
        url: string,
        ctx: Awaited<ReturnType<MailService['context']>>,
      ) => { subject: string; html: string; text: string },
    ) => {
      this.outbox.register(type, async (payload) => {
        const order = await this.getById(String(payload.orderId));
        if (!order) return;
        const ctx = await this.mail.context();
        const url = this.customerOrderUrl(order.id, String(payload.accessToken ?? ''));
        await this.mail.send({ to: order.customer.email, ...render(order, url, ctx) });
      });
    };
    register('email.order_created', (order, url, ctx) => orderCreatedTemplate(ctx, order, url));
    register('email.payment_confirmed', (order, url, ctx) =>
      paymentConfirmedTemplate(ctx, order, url),
    );
    register('email.order_shipped', (order, url, ctx) => orderShippedTemplate(ctx, order, url));
    register('email.order_status', (order, url, ctx) => orderStatusTemplate(ctx, order, url));
  }

  customerOrderUrl(orderId: string, accessToken?: string): string {
    const base = `${this.config.env.APP_URL}/pedido/${orderId}`;
    return accessToken ? `${base}?t=${encodeURIComponent(accessToken)}` : base;
  }

  // ---------- Leitura ----------

  private async load(
    orderId: string,
    executor: DbExecutor = this.db,
  ): Promise<OrderWithRelations | null> {
    const row = (await executor.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: RELATIONS,
    })) as OrderWithRelations | undefined;
    return row ?? null;
  }

  async getById(orderId: string): Promise<Order | null> {
    const row = await this.load(orderId);
    return row ? this.toOrder(row) : null;
  }

  /** Autoriza cliente logado (dono), visitante com token de acesso ou admin. Caso contrário, 404. */
  async assertCustomerAccess(
    orderId: string,
    auth?: AuthContext,
    accessToken?: string | null,
  ): Promise<OrderWithRelations> {
    const row = await this.load(orderId);
    if (!row) throw new NotFoundError('Pedido não encontrado', 'order_not_found');
    const isOwner = auth && row.userId && auth.user.id === row.userId;
    const isAdmin = auth?.user.role === 'admin' && auth.session.mfaVerified;
    const tokenOk = accessToken
      ? this.crypto.safeEqual(this.crypto.sha256(accessToken), row.accessTokenHash)
      : false;
    if (!isOwner && !isAdmin && !tokenOk)
      throw new NotFoundError('Pedido não encontrado', 'order_not_found');
    return row;
  }

  async getForCustomer(
    orderId: string,
    auth?: AuthContext,
    accessToken?: string | null,
  ): Promise<Order> {
    return this.toOrder(await this.assertCustomerAccess(orderId, auth, accessToken));
  }

  async listForUser(userId: string): Promise<OrderSummary[]> {
    const rows = (await this.db.query.orders.findMany({
      where: eq(orders.userId, userId),
      with: RELATIONS,
      orderBy: [desc(orders.createdAt)],
      limit: 100,
    })) as OrderWithRelations[];
    return rows.map((r) => this.toSummary(r));
  }

  async listAdmin(query: AdminOrderQuery): Promise<Paginated<OrderSummary>> {
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(orders.status, query.status));
    if (query.paymentMethod) conditions.push(eq(orders.paymentMethod, query.paymentMethod));
    if (query.paymentStatus) conditions.push(eq(orders.paymentStatus, query.paymentStatus));
    if (query.from)
      conditions.push(gte(orders.createdAt, new Date(`${query.from}T00:00:00-03:00`)));
    if (query.to) conditions.push(lte(orders.createdAt, new Date(`${query.to}T23:59:59-03:00`)));
    if (query.q) {
      const term = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
      conditions.push(
        or(
          ilike(orders.number, term),
          ilike(orders.customerName, term),
          ilike(orders.customerEmail, term),
          ilike(orders.trackingCode, term),
        )!,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [{ total }] = await this.db.select({ total: count() }).from(orders).where(where);
    const rows = (await this.db.query.orders.findMany({
      where,
      with: RELATIONS,
      orderBy: [desc(orders.createdAt)],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })) as OrderWithRelations[];
    return {
      items: rows.map((r) => this.toSummary(r)),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / query.pageSize)),
    };
  }

  async getAdmin(orderId: string): Promise<AdminOrder> {
    const row = await this.load(orderId);
    if (!row) throw new NotFoundError('Pedido não encontrado', 'order_not_found');
    return this.toAdminOrder(row);
  }

  // ---------- Transições ----------

  async handleProviderEvent(event: ProviderEvent): Promise<void> {
    let row =
      (await this.db.query.orders.findFirst({
        where: eq(orders.providerPaymentId, event.providerPaymentId),
      })) ?? null;
    if (!row && event.externalReference) {
      row =
        (await this.db.query.orders.findFirst({ where: eq(orders.id, event.externalReference) })) ??
        null;
    }
    if (!row) {
      this.logger.warn(
        { providerPaymentId: event.providerPaymentId, event: event.event },
        'Webhook para pedido desconhecido',
      );
      return;
    }
    switch (event.status) {
      case 'confirmed':
      case 'received':
        await this.markPaid(
          row.id,
          event.paidAt ? new Date(event.paidAt) : new Date(),
          'asaas',
          event.status,
        );
        return;
      case 'overdue':
        if (row.status === 'pending_payment') {
          await this.db
            .update(orders)
            .set({ paymentStatus: 'overdue', updatedAt: new Date() })
            .where(eq(orders.id, row.id));
          await this.addEvent(
            row.id,
            'payment_overdue',
            'Cobrança vencida sem pagamento identificado',
          );
        }
        return;
      case 'refunded':
        await this.markRefunded(row.id, null, 'Estorno registrado pelo provedor de pagamento');
        return;
      case 'cancelled':
        if (row.status === 'pending_payment')
          await this.cancel(row.id, null, 'Cobrança cancelada no provedor de pagamento');
        return;
      default:
        return;
    }
  }

  /** Confirma o pagamento: baixa o estoque reservado, muda o status e dispara o e-mail. Idempotente. */
  async markPaid(
    orderId: string,
    paidAt: Date,
    source: 'asaas' | 'mock' | 'admin',
    providerStatus: PaymentStatus = 'received',
    actor?: AuthUser,
  ): Promise<void> {
    const changed = await this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
      if (!row) throw new NotFoundError('Pedido não encontrado', 'order_not_found');
      if (row.status !== 'pending_payment') {
        if (
          row.paymentStatus !== providerStatus &&
          (row.status === 'paid' || row.status === 'processing')
        ) {
          await tx
            .update(orders)
            .set({ paymentStatus: providerStatus, updatedAt: new Date() })
            .where(eq(orders.id, orderId));
        }
        return false;
      }
      await this.commitStock(tx, row);
      await tx
        .update(orders)
        .set({
          status: 'paid',
          paymentStatus: providerStatus,
          paidAt,
          stockCommitted: true,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
      await this.addEvent(
        orderId,
        'payment_confirmed',
        `Pagamento confirmado (${source})`,
        tx,
        actor?.id,
      );
      await this.outbox.enqueue('email.payment_confirmed', { orderId }, tx);
      await this.audit.record(
        {
          actor,
          action: 'order.paid',
          entity: 'order',
          entityId: orderId,
          summary: `Pagamento confirmado via ${source}`,
        },
        tx,
      );
      this.metrics.paymentsConfirmed.inc({ payment_method: row.paymentMethod });
      return true;
    });
    if (changed) this.logger.info({ orderId, source }, 'Pedido pago');
  }

  private async commitStock(tx: DbExecutor, order: OrderRow): Promise<void> {
    if (order.stockCommitted) return;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      if (!item.variantId) continue;
      const [variant] = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .for('update');
      if (!variant) continue;
      await tx
        .update(productVariants)
        .set({
          stockQuantity: Math.max(0, variant.stockQuantity - item.quantity),
          reservedQuantity: Math.max(0, variant.reservedQuantity - item.quantity),
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, variant.id));
      await tx.insert(inventoryMovements).values({
        variantId: variant.id,
        delta: -item.quantity,
        reason: `Venda - pedido ${order.number}`,
        referenceType: 'order',
        referenceId: order.id,
      });
    }
  }

  /** Libera reservas (pedido não pago) ou devolve ao estoque (pedido pago). */
  private async releaseStock(tx: DbExecutor, order: OrderRow, reason: string): Promise<void> {
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      if (!item.variantId) continue;
      const [variant] = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .for('update');
      if (!variant) continue;
      if (order.stockCommitted) {
        await tx
          .update(productVariants)
          .set({ stockQuantity: variant.stockQuantity + item.quantity, updatedAt: new Date() })
          .where(eq(productVariants.id, variant.id));
        await tx.insert(inventoryMovements).values({
          variantId: variant.id,
          delta: item.quantity,
          reason: `${reason} - pedido ${order.number}`,
          referenceType: 'order',
          referenceId: order.id,
        });
      } else {
        await tx
          .update(productVariants)
          .set({
            reservedQuantity: Math.max(0, variant.reservedQuantity - item.quantity),
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, variant.id));
      }
    }
  }

  async cancel(orderId: string, actor: AuthUser | null, reason: string): Promise<void> {
    const row = await this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
      if (!current) throw new NotFoundError('Pedido não encontrado', 'order_not_found');
      if (!['pending_payment', 'paid', 'processing'].includes(current.status)) {
        throw new UnprocessableError(
          `Pedido ${ORDER_STATUS_LABELS[current.status].toLowerCase()} não pode ser cancelado`,
          'invalid_transition',
        );
      }
      await this.releaseStock(tx, current, 'Cancelamento');
      await tx
        .update(orders)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          paymentStatus: current.paymentStatus === 'pending' ? 'cancelled' : current.paymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
      await this.addEvent(orderId, 'cancelled', reason, tx, actor?.id);
      await this.outbox.enqueue('email.order_status', { orderId }, tx);
      await this.audit.record(
        { actor, action: 'order.cancel', entity: 'order', entityId: orderId, summary: reason },
        tx,
      );
      return current;
    });
    if (row.paymentStatus === 'pending')
      await this.payments.cancelCharge(row.providerName, row.providerPaymentId);
  }

  async markRefunded(orderId: string, actor: AuthUser | null, note: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
      if (!current) throw new NotFoundError('Pedido não encontrado', 'order_not_found');
      if (current.status === 'refunded') return;
      if (current.status === 'pending_payment') {
        throw new UnprocessableError(
          'Pedido ainda não pago não pode ser reembolsado; cancele-o',
          'invalid_transition',
        );
      }
      if (current.stockCommitted && current.status !== 'cancelled')
        await this.releaseStock(tx, current, 'Reembolso');
      await tx
        .update(orders)
        .set({ status: 'refunded', paymentStatus: 'refunded', updatedAt: new Date() })
        .where(eq(orders.id, orderId));
      await this.addEvent(orderId, 'payment_refunded', note, tx, actor?.id);
      await this.outbox.enqueue('email.order_status', { orderId }, tx);
      await this.audit.record(
        { actor, action: 'order.refund', entity: 'order', entityId: orderId, summary: note },
        tx,
      );
    });
  }

  async applyAdminAction(
    orderId: string,
    input: OrderActionInput,
    actor: AuthUser,
    ip?: string,
  ): Promise<AdminOrder> {
    const row = await this.load(orderId);
    if (!row) throw new NotFoundError('Pedido não encontrado', 'order_not_found');
    const now = new Date();
    const transition = async (
      from: string[],
      to: OrderRow['status'],
      eventType: OrderEventType,
      message: string,
      extra: Partial<typeof orders.$inferInsert> = {},
      email = true,
    ) => {
      if (!from.includes(row.status)) {
        throw new UnprocessableError(
          `Ação não permitida para pedido ${ORDER_STATUS_LABELS[row.status].toLowerCase()}`,
          'invalid_transition',
        );
      }
      await this.db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({ status: to, updatedAt: now, ...extra })
          .where(eq(orders.id, orderId));
        await this.addEvent(orderId, eventType, message, tx, actor.id);
        if (email)
          await this.outbox.enqueue(
            eventType === 'shipped' ? 'email.order_shipped' : 'email.order_status',
            { orderId },
            tx,
          );
        await this.audit.record(
          {
            actor,
            action: `order.${input.action}`,
            entity: 'order',
            entityId: orderId,
            summary: message,
            ip,
          },
          tx,
        );
      });
    };

    switch (input.action) {
      case 'mark_paid':
        if (row.status !== 'pending_payment') {
          throw new UnprocessableError(
            `Pedido ${ORDER_STATUS_LABELS[row.status].toLowerCase()} não pode ser marcado como pago`,
            'invalid_transition',
          );
        }
        await this.markPaid(orderId, now, 'admin', 'received', actor);
        break;
      case 'mark_processing':
        await transition(['paid'], 'processing', 'processing', input.note ?? 'Pedido em separação');
        break;
      case 'mark_shipped': {
        const tracking = input.trackingCode?.trim().toUpperCase();
        if (!tracking)
          throw new UnprocessableError(
            'Informe o código de rastreio dos Correios',
            'tracking_required',
            { trackingCode: ['Obrigatório'] },
          );
        await transition(
          ['paid', 'processing'],
          'shipped',
          'shipped',
          `Postado nos Correios com seguro. Rastreio ${tracking}`,
          { trackingCode: tracking, shippedAt: now },
        );
        break;
      }
      case 'mark_delivered':
        await transition(
          ['shipped'],
          'delivered',
          'delivered',
          input.note ?? 'Entrega confirmada',
          { deliveredAt: now },
        );
        break;
      case 'cancel':
        await this.cancel(orderId, actor, input.note ?? 'Cancelado pelo atendimento');
        break;
      case 'mark_refunded':
        await this.markRefunded(orderId, actor, input.note ?? 'Reembolso realizado');
        break;
      case 'add_note': {
        if (!input.note)
          throw new UnprocessableError('Informe a observação', 'note_required', {
            note: ['Obrigatório'],
          });
        await this.db.transaction(async (tx) => {
          await tx
            .update(orders)
            .set({
              internalNotes: [
                row.internalNotes,
                `[${now.toISOString()}] ${actor.name}: ${input.note}`,
              ]
                .filter(Boolean)
                .join('\n'),
              updatedAt: now,
            })
            .where(eq(orders.id, orderId));
          await this.addEvent(orderId, 'note', input.note!, tx, actor.id);
          await this.audit.record(
            {
              actor,
              action: 'order.note',
              entity: 'order',
              entityId: orderId,
              summary: input.note,
              ip,
            },
            tx,
          );
        });
        break;
      }
    }
    return this.getAdmin(orderId);
  }

  async addEvent(
    orderId: string,
    type: OrderEventType,
    message: string,
    executor: DbExecutor = this.db,
    actorId?: string | null,
  ): Promise<void> {
    await executor.insert(orderEvents).values({ orderId, type, message, actorId: actorId ?? null });
  }

  /** Cancela pedidos pendentes há muitos dias e libera as reservas de estoque. */
  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingOrders(): Promise<number> {
    if (this.config.isTest) return 0;
    const cutoff = new Date(Date.now() - PENDING_EXPIRATION_DAYS * 86_400_000);
    const stale = await this.db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.status, 'pending_payment'), lt(orders.createdAt, cutoff)))
      .limit(50);
    for (const { id } of stale) {
      try {
        await this.cancel(
          id,
          null,
          'Pagamento não identificado no prazo; pedido expirado automaticamente',
        );
      } catch (error) {
        this.logger.warn({ err: error, orderId: id }, 'Falha ao expirar pedido');
      }
    }
    return stale.length;
  }

  async countByIds(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(orders)
      .where(inArray(orders.id, ids));
    return Number(n);
  }

  // ---------- Mapeamento ----------

  private paymentInstructions(row: OrderRow): Order['payment'] {
    return {
      method: row.paymentMethod,
      status: row.paymentStatus,
      installments: row.installments,
      installmentCents: row.installmentCents,
      pix:
        row.paymentMethod === 'pix' && row.pixPayload
          ? {
              payload: row.pixPayload,
              qrCodeBase64: row.pixQrCodeBase64,
              expiresAt: row.pixExpiresAt?.toISOString() ?? null,
            }
          : null,
      boleto:
        row.paymentMethod === 'boleto' && row.boletoUrl
          ? {
              url: row.boletoUrl,
              identificationField: row.boletoIdentificationField,
              dueDate: row.boletoDueDate ?? '',
            }
          : null,
      creditCard:
        row.paymentMethod === 'credit_card' && row.providerInvoiceUrl
          ? { checkoutUrl: row.providerInvoiceUrl }
          : null,
      paidAt: row.paidAt?.toISOString() ?? null,
    };
  }

  toOrder(row: OrderWithRelations): Order {
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      statusLabel: ORDER_STATUS_LABELS[row.status],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      items: row.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productSlug: item.productSlug,
        name: item.name,
        variantName: item.variantName,
        sku: item.sku,
        imageUrl: item.imageUrl,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        totalCents: item.totalCents,
      })),
      subtotalCents: row.subtotalCents,
      discountCents: row.discountCents,
      shippingCents: row.shippingCents,
      insuranceCents: row.insuranceCents,
      totalCents: row.totalCents,
      couponCode: row.couponCode,
      shippingService: row.shippingService,
      shippingDeadlineDays: row.shippingDeadlineDays,
      shippingAddress: row.shippingAddress,
      customer: {
        name: row.customerName,
        email: row.customerEmail,
        phone: row.customerPhone,
        cpfMasked: row.customerCpfMasked,
      },
      payment: this.paymentInstructions(row),
      trackingCode: row.trackingCode,
      trackingUrl: trackingUrlFor(row.trackingCode),
      notes: row.notes,
      events: [...row.events]
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((e) => ({
          id: e.id,
          type: e.type,
          message: e.message,
          createdAt: e.createdAt.toISOString(),
        })),
    };
  }

  toAdminOrder(row: OrderWithRelations): AdminOrder {
    const base = this.toOrder(row);
    let cpf = '';
    try {
      cpf = this.crypto.decrypt(row.customerCpfEncrypted);
    } catch {
      cpf = row.customerCpfMasked;
    }
    return {
      ...base,
      userId: row.userId,
      customer: { name: row.customerName, email: row.customerEmail, phone: row.customerPhone, cpf },
      providerPaymentId: row.providerPaymentId,
      providerCustomerId: row.providerCustomerId,
      internalNotes: row.internalNotes,
    };
  }

  toSummary(row: OrderWithRelations): OrderSummary {
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      statusLabel: ORDER_STATUS_LABELS[row.status],
      totalCents: row.totalCents,
      itemCount: row.items.reduce((sum, i) => sum + i.quantity, 0),
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
