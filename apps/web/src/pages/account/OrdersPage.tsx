import { useQuery } from '@tanstack/react-query';
import { type OrderStatus, type OrderSummary, PAYMENT_METHOD_LABELS } from '@vellor/shared';
import { Package } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Link } from 'react-router';
import { LinkButton } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState, PageLoader } from '@/components/ui/feedback';
import { t } from '@/i18n/pt-BR';
import { accountApi } from '@/lib/api';
import { formatBRL, formatDateTime, pluralize } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

type BadgeTone = NonNullable<ComponentProps<typeof Badge>['tone']>;

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pending_payment: 'warning',
  paid: 'info',
  processing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'danger',
};

const VIEW_ORDER = 'Ver pedido';

function itemsLabel(count: number): string {
  return `${count} ${pluralize(count, t('cart.item'), t('cart.items'))}`;
}

export default function OrdersPage() {
  usePageMeta(t('account.orders'));
  const query = useQuery({ queryKey: ['account', 'orders'], queryFn: accountApi.orders });
  const orders = query.data ?? [];

  return (
    <section aria-labelledby="orders-title">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="orders-title" className="heading text-xl">
          {t('account.orders')}
        </h2>
        {orders.length > 0 && (
          <span className="text-xs uppercase tracking-[0.15em] text-muted">
            {orders.length} {pluralize(orders.length, 'pedido', 'pedidos')}
          </span>
        )}
      </div>

      <div className="mt-6">
        {query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title={t('account.noOrders')}
            text="Quando você concluir uma compra, ela aparecerá aqui com o status de pagamento e entrega."
            action={<LinkButton to="/relogios">{t('home.heroCtaWatches')}</LinkButton>}
          />
        ) : (
          <>
            <OrdersTable orders={orders} />
            <OrdersCards orders={orders} />
          </>
        )}
      </div>
    </section>
  );
}

function OrdersTable({ orders }: { orders: OrderSummary[] }) {
  return (
    <div className="card hidden overflow-x-auto md:block">
      <table className="table" data-testid="orders-table">
        <thead>
          <tr>
            <th scope="col">Pedido</th>
            <th scope="col">{t('common.date')}</th>
            <th scope="col">{t('order.items')}</th>
            <th scope="col">{t('order.payment')}</th>
            <th scope="col">{t('common.status')}</th>
            <th scope="col" className="text-right">
              {t('common.total')}
            </th>
            <th scope="col">
              <span className="sr-only">{t('common.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} data-testid="order-row">
              <td className="font-medium text-cream">{order.number}</td>
              <td className="text-ivory/80">{formatDateTime(order.createdAt)}</td>
              <td className="text-ivory/80">{itemsLabel(order.itemCount)}</td>
              <td className="text-ivory/80">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</td>
              <td>
                <Badge tone={STATUS_TONE[order.status]}>{order.statusLabel}</Badge>
              </td>
              <td className="text-right font-medium text-gold">{formatBRL(order.totalCents)}</td>
              <td className="text-right">
                <Link
                  to={`/pedido/${order.id}`}
                  className="link text-[11px] font-semibold uppercase tracking-[0.15em]"
                >
                  {VIEW_ORDER}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersCards({ orders }: { orders: OrderSummary[] }) {
  return (
    <ul className="space-y-3 md:hidden">
      {orders.map((order) => (
        <li key={order.id} className="card p-4" data-testid="order-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-cream">
                {t('order.title', { number: order.number })}
              </p>
              <p className="mt-0.5 text-xs text-muted">{formatDateTime(order.createdAt)}</p>
            </div>
            <Badge tone={STATUS_TONE[order.status]}>{order.statusLabel}</Badge>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted">{t('order.items')}</dt>
              <dd className="mt-0.5 text-ivory/90">{itemsLabel(order.itemCount)}</dd>
            </div>
            <div>
              <dt className="text-muted">{t('order.payment')}</dt>
              <dd className="mt-0.5 text-ivory/90">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
            </div>
          </dl>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <span className="font-medium text-gold">{formatBRL(order.totalCents)}</span>
            <Link
              to={`/pedido/${order.id}`}
              className="link text-[11px] font-semibold uppercase tracking-[0.15em]"
            >
              {VIEW_ORDER}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
