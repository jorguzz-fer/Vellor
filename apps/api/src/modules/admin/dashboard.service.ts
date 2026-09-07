import { Injectable } from '@nestjs/common';
import { type DashboardStats, ORDER_STATUSES, type OrderStatus } from '@vellor/shared';
import { and, count, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { type Database, InjectDb } from '../../database/database.module';
import {
  contactRequests,
  newsletterSubscribers,
  orders,
  productVariants,
  products,
} from '../../database/schema';
import { OrdersService } from '../orders/orders.service';

const PAID_STATUSES: OrderStatus[] = ['paid', 'processing', 'shipped', 'delivered'];
const TZ = 'America/Sao_Paulo';

@Injectable()
export class DashboardService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly orders: OrdersService,
  ) {}

  async stats(): Promise<DashboardStats> {
    const now = Date.now();
    const startOfToday = new Date(
      new Date().toLocaleDateString('en-CA', { timeZone: TZ }) + 'T00:00:00-03:00',
    );
    const since7d = new Date(now - 7 * 86_400_000);
    const since30d = new Date(now - 30 * 86_400_000);
    const since14d = new Date(now - 14 * 86_400_000);

    const revenue = async (since: Date) => {
      const [row] = await this.db
        .select({ total: sql<number>`coalesce(sum(${orders.totalCents}), 0)`, n: count() })
        .from(orders)
        .where(and(inArray(orders.status, PAID_STATUSES), gte(orders.paidAt, since)));
      return { total: Number(row?.total ?? 0), n: Number(row?.n ?? 0) };
    };

    const [today, week, month] = await Promise.all([
      revenue(startOfToday),
      revenue(since7d),
      revenue(since30d),
    ]);

    const [ordersToday] = await this.db
      .select({ n: count() })
      .from(orders)
      .where(gte(orders.createdAt, startOfToday));
    const [orders30d] = await this.db
      .select({ n: count() })
      .from(orders)
      .where(gte(orders.createdAt, since30d));

    const byStatusRows = await this.db
      .select({ status: orders.status, n: count() })
      .from(orders)
      .groupBy(orders.status);
    const ordersByStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
      OrderStatus,
      number
    >;
    for (const row of byStatusRows) ordersByStatus[row.status] = Number(row.n);

    const lowStockRows = await this.db
      .select({
        productId: products.id,
        productName: products.name,
        variantName: productVariants.name,
        sku: productVariants.sku,
        stockQuantity: sql<number>`${productVariants.stockQuantity} - ${productVariants.reservedQuantity}`,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(
        and(
          eq(productVariants.isActive, true),
          eq(products.status, 'active'),
          isNull(products.deletedAt),
          sql`${productVariants.stockQuantity} - ${productVariants.reservedQuantity} <= 2`,
        ),
      )
      .orderBy(
        sql`${productVariants.stockQuantity} - ${productVariants.reservedQuantity}`,
        desc(products.updatedAt),
      )
      .limit(20);

    const [pendingContacts] = await this.db
      .select({ n: count() })
      .from(contactRequests)
      .where(eq(contactRequests.status, 'new'));
    const [subscribers] = await this.db
      .select({ n: count() })
      .from(newsletterSubscribers)
      .where(isNull(newsletterSubscribers.unsubscribedAt));

    const dayExpr = sql<string>`to_char(${orders.paidAt} at time zone ${sql.raw(`'${TZ}'`)}, 'YYYY-MM-DD')`;
    const salesRows = await this.db
      .select({
        date: dayExpr,
        revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)`,
        n: count(),
      })
      .from(orders)
      .where(and(inArray(orders.status, PAID_STATUSES), gte(orders.paidAt, since14d)))
      .groupBy(dayExpr)
      .orderBy(dayExpr);
    const salesByDate = new Map(
      salesRows.map((r) => [r.date, { revenueCents: Number(r.revenue), orders: Number(r.n) }]),
    );
    const salesByDay: DashboardStats['salesByDay'] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now - i * 86_400_000).toLocaleDateString('en-CA', { timeZone: TZ });
      const entry = salesByDate.get(date);
      salesByDay.push({ date, revenueCents: entry?.revenueCents ?? 0, orders: entry?.orders ?? 0 });
    }

    const recent = await this.orders.listAdmin({ page: 1, pageSize: 8 });

    return {
      revenueTodayCents: today.total,
      revenue7dCents: week.total,
      revenue30dCents: month.total,
      ordersToday: Number(ordersToday?.n ?? 0),
      orders30d: Number(orders30d?.n ?? 0),
      averageTicket30dCents: month.n ? Math.round(month.total / month.n) : 0,
      ordersByStatus,
      lowStock: lowStockRows.map((r) => ({ ...r, stockQuantity: Number(r.stockQuantity) })),
      recentOrders: recent.items,
      pendingContacts: Number(pendingContacts?.n ?? 0),
      newsletterSubscribers: Number(subscribers?.n ?? 0),
      salesByDay,
    };
  }
}
