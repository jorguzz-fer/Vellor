import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  type AdminOrderQuery,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from '@vellor/shared';
import { Search, X } from 'lucide-react';
import { type ComponentProps, type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState, PageLoader, Spinner } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n/pt-BR';
import { ApiError, adminApi } from '@/lib/api';
import { formatBRL, formatDateTime } from '@/lib/format';
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

const PAGE_SIZE = 20;
const FILTER_KEYS = ['q', 'status', 'paymentMethod', 'paymentStatus', 'from', 'to'] as const;

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function pickDate(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export default function OrdersPage() {
  usePageMeta(`${t('admin.orders')} · ${t('admin.title')}`);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const params: Partial<AdminOrderQuery> = {
    page: Math.max(1, Number(searchParams.get('page')) || 1),
    pageSize: PAGE_SIZE,
    q: searchParams.get('q')?.trim() || undefined,
    status: pick(searchParams.get('status'), ORDER_STATUSES),
    paymentMethod: pick(searchParams.get('paymentMethod'), PAYMENT_METHODS),
    paymentStatus: pick(searchParams.get('paymentStatus'), PAYMENT_STATUSES),
    from: pickDate(searchParams.get('from')),
    to: pickDate(searchParams.get('to')),
  };
  const hasFilters = FILTER_KEYS.some((key) => Boolean(params[key]));

  const [q, setQ] = useState(params.q ?? '');
  useEffect(() => {
    setQ(params.q ?? '');
  }, [params.q]);

  const query = useQuery({
    queryKey: ['admin', 'orders', params],
    queryFn: () => adminApi.orders(params),
    placeholderData: keepPreviousData,
  });

  /** Atualiza a URL; qualquer mudança de filtro volta para a primeira página. */
  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in patch)) next.delete('page');
    setSearchParams(next);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    update({ q: q.trim() || undefined });
  };

  const data = query.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="heading text-2xl">{t('admin.orders')}</h1>
        {data && (
          <span className="text-xs text-muted">
            {data.total} {data.total === 1 ? 'pedido' : 'pedidos'}
            {query.isFetching && <Spinner size={12} className="ml-2 align-middle" />}
          </span>
        )}
      </div>

      <form
        onSubmit={submitSearch}
        className="card grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6"
        aria-label="Filtros de pedidos"
      >
        <Input
          label={t('common.search')}
          name="q"
          type="search"
          placeholder="Número, nome ou e-mail"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          wrapperClassName="md:col-span-3 xl:col-span-2"
        />
        <Select
          label={t('common.status')}
          name="status"
          value={params.status ?? ''}
          onChange={(e) => update({ status: e.target.value || undefined })}
          placeholder={t('common.all')}
          options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))}
        />
        <Select
          label="Pagamento"
          name="paymentMethod"
          value={params.paymentMethod ?? ''}
          onChange={(e) => update({ paymentMethod: e.target.value || undefined })}
          placeholder={t('common.all')}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
        />
        <Select
          label="Situação do pagamento"
          name="paymentStatus"
          value={params.paymentStatus ?? ''}
          onChange={(e) => update({ paymentStatus: e.target.value || undefined })}
          placeholder={t('common.all')}
          options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="De"
            name="from"
            type="date"
            value={params.from ?? ''}
            max={params.to}
            onChange={(e) => update({ from: e.target.value || undefined })}
          />
          <Input
            label="Até"
            name="to"
            type="date"
            value={params.to ?? ''}
            min={params.from}
            onChange={(e) => update({ to: e.target.value || undefined })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-3 xl:col-span-6">
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            icon={<Search className="h-3.5 w-3.5" />}
          >
            {t('common.filter')}
          </Button>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<X className="h-3.5 w-3.5" />}
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              {t('common.clearFilters')}
            </Button>
          )}
        </div>
      </form>

      {query.isPending ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : undefined}
          onRetry={() => query.refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Nenhum pedido encontrado"
            text={
              hasFilters
                ? 'Ajuste os filtros ou limpe a busca para ver todos os pedidos.'
                : 'Os pedidos da loja aparecerão aqui.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => setSearchParams(new URLSearchParams())}>
                  {t('common.clearFilters')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className={`card transition-opacity ${query.isFetching ? 'opacity-70' : ''}`}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>{t('common.date')}</th>
                  <th>Cliente</th>
                  <th className="text-right">Itens</th>
                  <th>Pagamento</th>
                  <th>{t('common.status')}</th>
                  <th className="text-right">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => (
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
                    <td>
                      <span className="block max-w-[220px] truncate">{order.customerName}</span>
                      <span className="block max-w-[220px] truncate text-xs text-muted">
                        {order.customerEmail}
                      </span>
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
          <div className="px-4">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              label="pedidos"
              onChange={(page) => update({ page: String(page) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
