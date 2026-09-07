import { useQuery } from '@tanstack/react-query';
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from '@vellor/shared';
import { ArrowLeft, MapPin } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { LinkButton } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState, PageLoader } from '@/components/ui/feedback';
import { t } from '@/i18n/pt-BR';
import { ApiError, adminApi } from '@/lib/api';
import { formatBRL, formatCEP, formatDate, formatDateTime, formatPhoneBR } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

type Tone = NonNullable<ComponentProps<typeof Badge>['tone']>;

const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending_payment: 'warning',
  paid: 'info',
  processing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'danger',
};

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  pending: 'warning',
  confirmed: 'success',
  received: 'success',
  overdue: 'danger',
  refunded: 'muted',
  cancelled: 'muted',
};

export default function CustomerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['admin', 'customer', id],
    queryFn: () => adminApi.customer(id),
    enabled: Boolean(id),
  });
  usePageMeta(
    query.data
      ? `${query.data.name} · ${t('admin.customers')}`
      : `${t('admin.customers')} · ${t('admin.title')}`,
  );

  if (query.isPending) return <PageLoader />;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : undefined}
          onRetry={() => query.refetch()}
        />
        <div className="text-center">
          <LinkButton to="/admin/clientes" variant="secondary">
            {t('common.back')}
          </LinkButton>
        </div>
      </div>
    );
  }

  const customer = query.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/clientes"
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t('admin.customers')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="heading text-2xl">{customer.name}</h1>
            {customer.newsletterOptIn && <Badge tone="gold">Newsletter</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted">Cliente desde {formatDate(customer.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Total gasto
          </p>
          <p className="font-display text-3xl text-gold">{formatBRL(customer.totalSpentCents)}</p>
          <p className="text-xs text-muted">
            {customer.ordersCount} {customer.ordersCount === 1 ? 'pedido' : 'pedidos'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5" aria-label="Dados do cliente">
          <h2 className="heading mb-4 text-lg">Dados do cliente</h2>
          <dl className="space-y-3 text-sm">
            <Row label={t('account.email')} stack>
              <a href={`mailto:${customer.email}`} className="link break-all">
                {customer.email}
              </a>
            </Row>
            <Row label={t('account.phone')}>
              {customer.phone ? (
                <a href={`tel:+55${customer.phone.replace(/\D/g, '')}`} className="link">
                  {formatPhoneBR(customer.phone)}
                </a>
              ) : (
                '—'
              )}
            </Row>
            <Row label={t('account.cpf')}>{customer.cpfMasked ?? '—'}</Row>
            <Row label="Newsletter">
              {customer.newsletterOptIn ? t('common.yes') : t('common.no')}
            </Row>
            <Row label="Cadastro">{formatDateTime(customer.createdAt)}</Row>
            <Row label="Último pedido">
              {customer.lastOrderAt ? formatDateTime(customer.lastOrderAt) : '—'}
            </Row>
          </dl>
        </section>

        <section className="card p-5 lg:col-span-2" aria-label="Endereços">
          <h2 className="heading mb-4 text-lg">{t('account.addresses')}</h2>
          {customer.addresses.length === 0 ? (
            <p className="text-sm text-muted">{t('account.noAddresses')}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {customer.addresses.map((address) => (
                <li
                  key={address.id}
                  className="rounded-sm border border-line bg-noir/40 p-4 text-sm"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                      <MapPin className="h-3.5 w-3.5 text-gold" /> {address.label ?? 'Endereço'}
                    </span>
                    {address.isDefault && <Badge tone="gold">{t('account.defaultAddress')}</Badge>}
                  </div>
                  {address.recipientName && <p className="text-cream">{address.recipientName}</p>}
                  <p className="text-ivory/80">
                    {address.street}, {address.number}
                    {address.complement ? ` – ${address.complement}` : ''}
                  </p>
                  <p className="text-ivory/80">{address.district}</p>
                  <p className="text-ivory/80">
                    {address.city} – {address.state}
                  </p>
                  <p className="text-ivory/80">CEP {formatCEP(address.cep)}</p>
                  {address.reference && (
                    <p className="mt-1 text-xs text-muted">Ref.: {address.reference}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card" aria-label="Pedidos do cliente">
        <div className="border-b border-line px-5 py-4">
          <h2 className="heading text-lg">{t('admin.orders')}</h2>
        </div>
        {customer.orders.length === 0 ? (
          <EmptyState title="Nenhum pedido" text="Este cliente ainda não fez pedidos." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>{t('common.date')}</th>
                  <th className="text-right">Itens</th>
                  <th>Pagamento</th>
                  <th>{t('common.status')}</th>
                  <th className="text-right">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a')) return;
                      navigate(`/admin/pedidos/${order.id}`);
                    }}
                  >
                    <td>
                      <Link
                        to={`/admin/pedidos/${order.id}`}
                        className="font-medium text-gold hover:underline"
                      >
                        {order.number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="text-right">{order.itemCount}</td>
                    <td>
                      <span className="block whitespace-nowrap text-xs">
                        {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                      </span>
                      <Badge tone={PAYMENT_TONE[order.paymentStatus]} className="mt-1">
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap text-right font-medium">
                      {formatBRL(order.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Par rótulo/valor; `stack` mantém o valor abaixo do rótulo (para e-mails longos). */
function Row({ label, children, stack }: { label: string; children: ReactNode; stack?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-0.5 ${stack ? '' : 'sm:flex-row sm:items-baseline sm:justify-between sm:gap-4'}`}
    >
      <dt className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </dt>
      <dd className={`min-w-0 text-ivory/90 ${stack ? '' : 'sm:text-right'}`}>{children}</dd>
    </div>
  );
}
