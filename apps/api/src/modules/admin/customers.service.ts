import { Injectable } from '@nestjs/common';
import type { CustomerDetail, CustomerSummary, Paginated } from '@vellor/shared';
import { and, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { NotFoundError } from '../../common/errors';
import { type Database, InjectDb } from '../../database/database.module';
import { orders, users } from '../../database/schema';
import { toAddress } from '../account/account.service';
import { OrdersService, type OrderWithRelations } from '../orders/orders.service';

const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered'] as const;

@Injectable()
export class CustomersService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly orders: OrdersService,
  ) {}

  async list(query: {
    page: number;
    pageSize: number;
    q?: string;
  }): Promise<Paginated<CustomerSummary>> {
    const conditions: SQL[] = [eq(users.role, 'customer'), isNull(users.deletedAt)];
    if (query.q) {
      const term = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
      conditions.push(or(ilike(users.name, term), ilike(users.email, term))!);
    }
    const where = and(...conditions);
    const [{ total }] = await this.db.select({ total: count() }).from(users).where(where);
    const rows = await this.db
      .select({
        user: users,
        ordersCount: sql<number>`(select count(*) from ${orders} where ${orders.userId} = ${users.id})`,
        totalSpent: sql<number>`(select coalesce(sum(${orders.totalCents}), 0) from ${orders} where ${orders.userId} = ${users.id} and ${orders.status} in ('paid','processing','shipped','delivered'))`,
        lastOrderAt: sql<Date | null>`(select max(${orders.createdAt}) from ${orders} where ${orders.userId} = ${users.id})`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return {
      items: rows.map((r) => ({
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        phone: r.user.phone,
        cpfMasked: r.user.cpfMasked,
        ordersCount: Number(r.ordersCount),
        totalSpentCents: Number(r.totalSpent),
        newsletterOptIn: r.user.newsletterOptIn,
        createdAt: r.user.createdAt.toISOString(),
        lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt).toISOString() : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / query.pageSize)),
    };
  }

  async get(id: string): Promise<CustomerDetail> {
    const user = await this.db.query.users.findFirst({
      where: and(eq(users.id, id), isNull(users.deletedAt)),
      with: { addresses: true },
    });
    if (!user) throw new NotFoundError('Cliente não encontrado', 'customer_not_found');
    const orderRows = (await this.db.query.orders.findMany({
      where: eq(orders.userId, id),
      with: { items: true, events: true },
      orderBy: [desc(orders.createdAt)],
      limit: 50,
    })) as OrderWithRelations[];
    const summaries = orderRows.map((o) => this.orders.toSummary(o));
    const paid = orderRows.filter((o) => (PAID_STATUSES as readonly string[]).includes(o.status));
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpfMasked: user.cpfMasked,
      ordersCount: orderRows.length,
      totalSpentCents: paid.reduce((sum, o) => sum + o.totalCents, 0),
      newsletterOptIn: user.newsletterOptIn,
      createdAt: user.createdAt.toISOString(),
      lastOrderAt: orderRows[0]?.createdAt.toISOString() ?? null,
      addresses: user.addresses.map(toAddress),
      orders: summaries,
    };
  }

  async countByIds(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    const [{ n }] = await this.db.select({ n: count() }).from(users).where(inArray(users.id, ids));
    return Number(n);
  }
}
