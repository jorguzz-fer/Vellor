import { useQuery } from '@tanstack/react-query';
import {
  type DashboardStats,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from '@vellor/shared';
import { ArrowRight, Mail, MessageSquare, PackageOpen, RefreshCw } from 'lucide-react';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge, ErrorState, PageLoader } from '@/components/ui/feedback';
import { t } from '@/i18n/pt-BR';
import { ApiError, adminApi } from '@/lib/api';
import { formatBRL, formatDateTime, pluralize } from '@/lib/format';
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

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});
const compactFormatter = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** "R$ 12,3 mil" para eixos e resumos compactos. */
function compactBRL(cents: number): string {
  return `R$ ${compactFormatter.format(cents / 100)}`;
}

/** "2026-09-07" -> "07/09". */
function shortDay(isoDate: string): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

export default function DashboardPage() {
  usePageMeta(`${t('admin.dashboard')} · ${t('admin.title')}`);
  const query = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminApi.dashboard,
    refetchInterval: 60_000,
  });

  if (query.isPending) return <PageLoader />;
  if (query.isError) {
    return (
      <ErrorState
        message={query.error instanceof ApiError ? query.error.message : undefined}
        onRetry={() => query.refetch()}
      />
    );
  }

  const stats = query.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading text-2xl">{t('admin.dashboard')}</h1>
          <p className="mt-1 text-xs text-muted">
            Atualizado às {timeFormatter.format(new Date(query.dataUpdatedAt))} · atualização
            automática a cada minuto
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          loading={query.isFetching}
          onClick={() => query.refetch()}
        >
          Atualizar
        </Button>
      </div>

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi
          label="Receita hoje"
          value={formatBRL(stats.revenueTodayCents)}
          hint={`${stats.ordersToday} ${pluralize(stats.ordersToday, 'pedido criado', 'pedidos criados')} hoje`}
        />
        <Kpi
          label="Receita 7 dias"
          value={formatBRL(stats.revenue7dCents)}
          hint="Pedidos pagos nos últimos 7 dias"
        />
        <Kpi
          label="Receita 30 dias"
          value={formatBRL(stats.revenue30dCents)}
          hint="Pedidos pagos nos últimos 30 dias"
        />
        <Kpi
          label="Pedidos hoje"
          value={String(stats.ordersToday)}
          hint="Criados desde a meia-noite"
        />
        <Kpi
          label="Pedidos 30 dias"
          value={String(stats.orders30d)}
          hint="Criados nos últimos 30 dias"
        />
        <Kpi
          label="Ticket médio (30 dias)"
          value={formatBRL(stats.averageTicket30dCents)}
          hint="Média dos pedidos pagos"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2 xl:self-start" aria-label="Vendas por dia">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="heading text-lg">Vendas por dia</h2>
            <span className="text-xs text-muted">
              Receita paga nos últimos {stats.salesByDay.length} dias
            </span>
          </div>
          <SalesChart data={stats.salesByDay} />
        </section>

        <div className="space-y-6">
          <section className="card p-5" aria-label="Pedidos por status">
            <h2 className="heading mb-4 text-lg">Pedidos por status</h2>
            <ul className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map((status) => (
                <li key={status}>
                  <Link
                    to={`/admin/pedidos?status=${status}`}
                    className="inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    title={`Ver pedidos: ${ORDER_STATUS_LABELS[status]}`}
                  >
                    <Badge tone={STATUS_TONE[status]}>
                      {ORDER_STATUS_LABELS[status]}
                      <span className="ml-1 rounded-sm bg-noir/60 px-1.5 py-px text-[10px] text-cream">
                        {stats.ordersByStatus[status] ?? 0}
                      </span>
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"
            aria-label="Atendimento e newsletter"
          >
            <Link
              to="/admin/atendimento?status=new"
              className="card group flex items-center gap-4 p-5 transition-colors hover:border-gold/60"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border ${stats.pendingContacts > 0 ? 'border-warning/40 bg-warning/10 text-warning' : 'border-line-strong bg-spruce text-muted'}`}
              >
                <MessageSquare className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Atendimento pendente
                </span>
                <span className="block font-display text-2xl text-cream">
                  {stats.pendingContacts}
                </span>
                <span className="block text-xs text-muted">
                  {pluralize(stats.pendingContacts, 'mensagem nova', 'mensagens novas')}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted transition-colors group-hover:text-gold" />
            </Link>
            <Link
              to="/admin/newsletter"
              className="card group flex items-center gap-4 p-5 transition-colors hover:border-gold/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-gold/40 bg-gold/10 text-gold">
                <Mail className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Newsletter
                </span>
                <span className="block font-display text-2xl text-cream">
                  {stats.newsletterSubscribers}
                </span>
                <span className="block text-xs text-muted">
                  {pluralize(stats.newsletterSubscribers, 'inscrito ativo', 'inscritos ativos')}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted transition-colors group-hover:text-gold" />
            </Link>
          </section>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentOrders orders={stats.recentOrders} />
        <LowStock items={stats.lowStock} />
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl text-gold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

// ---------- Gráfico de vendas (SVG puro) ----------

function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Arredonda para cima até um valor "redondo" (1, 2, 2.5, 5 × 10^n) para o topo do eixo. */
function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const mantissa = value / power;
  const nice =
    mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 2.5 ? 2.5 : mantissa <= 5 ? 5 : 10;
  return nice * power;
}

function SalesChart({ data }: { data: DashboardStats['salesByDay'] }) {
  const [ref, width] = useContainerWidth<HTMLDivElement>();
  const height = 220;
  const pad = { top: 12, right: 8, bottom: 28, left: 60 };
  const max = data.reduce((m, d) => Math.max(m, d.revenueCents), 0);
  const axisMax = max > 0 ? niceCeil(max) : 100_00;
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.max(4, Math.min(40, slot * 0.6));
  const labelEvery = slot < 34 ? 2 : 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const totalRevenue = data.reduce((sum, d) => sum + d.revenueCents, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);
  const description = data
    .map((d) => `${shortDay(d.date)}: ${formatBRL(d.revenueCents)}`)
    .join('; ');

  return (
    <div>
      <div ref={ref} className="relative w-full">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Receita por dia. ${description}`}
            className="block"
          >
            {ticks.map((fraction) => {
              const y = pad.top + innerH - fraction * innerH;
              return (
                <g key={fraction}>
                  <line
                    x1={pad.left}
                    x2={width - pad.right}
                    y1={y}
                    y2={y}
                    className={fraction === 0 ? 'stroke-line-strong' : 'stroke-line'}
                    strokeWidth={1}
                  />
                  <text
                    x={pad.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-muted text-[10px]"
                  >
                    {compactBRL(fraction * axisMax)}
                  </text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const h = (d.revenueCents / axisMax) * innerH;
              const x = pad.left + i * slot + (slot - barW) / 2;
              const y = pad.top + innerH - h;
              const showLabel = (data.length - 1 - i) % labelEvery === 0;
              return (
                <g key={d.date}>
                  <title>{`${shortDay(d.date)}: ${formatBRL(d.revenueCents)} · ${d.orders} ${pluralize(d.orders, 'pedido', 'pedidos')}`}</title>
                  {d.revenueCents > 0 ? (
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={1}
                      className="fill-gold transition-colors hover:fill-gold-light"
                    />
                  ) : (
                    <rect
                      x={x}
                      y={pad.top + innerH - 2}
                      width={barW}
                      height={2}
                      className="fill-line-strong"
                    />
                  )}
                  {showLabel && (
                    <text
                      x={x + barW / 2}
                      y={height - 10}
                      textAnchor="middle"
                      className="fill-muted text-[10px]"
                    >
                      {shortDay(d.date)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {totalRevenue === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-muted">
            Sem vendas pagas no período.
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        <span className="text-cream">{formatBRL(totalRevenue)}</span> em {totalOrders}{' '}
        {pluralize(totalOrders, 'pedido pago', 'pedidos pagos')} no período
      </p>
    </div>
  );
}

// ---------- Tabelas ----------

function RecentOrders({ orders }: { orders: DashboardStats['recentOrders'] }) {
  const navigate = useNavigate();
  return (
    <section className="card" aria-label="Pedidos recentes">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="heading text-lg">Pedidos recentes</h2>
        <Link to="/admin/pedidos" className="link text-xs uppercase tracking-[0.15em]">
          {t('common.seeAll')}
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Nenhum pedido ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
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
                  <td>
                    <span className="block max-w-[180px] truncate">{order.customerName}</span>
                    <span className="block max-w-[180px] truncate text-xs text-muted">
                      {order.customerEmail}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-right font-medium">
                    {formatBRL(order.totalCents)}
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap text-xs text-muted">
                    {formatDateTime(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LowStock({ items }: { items: DashboardStats['lowStock'] }) {
  return (
    <section className="card" aria-label="Estoque baixo">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="heading text-lg">Estoque baixo</h2>
        <Link to="/admin/produtos" className="link text-xs uppercase tracking-[0.15em]">
          {t('admin.products')}
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-muted">
          <PackageOpen className="h-5 w-5 text-gold/70" />
          Nenhuma variação com estoque baixo.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Variação</th>
                <th>SKU</th>
                <th className="text-right">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.productId}-${item.sku}`}>
                  <td>
                    <Link
                      to={`/admin/produtos/${item.productId}`}
                      className="font-medium text-gold hover:underline"
                    >
                      {item.productName}
                    </Link>
                  </td>
                  <td className="text-ivory/80">{item.variantName}</td>
                  <td className="font-mono text-xs text-muted">{item.sku}</td>
                  <td className="text-right">
                    <Badge tone={item.stockQuantity <= 0 ? 'danger' : 'warning'}>
                      {item.stockQuantity <= 0
                        ? t('common.outOfStock')
                        : `${item.stockQuantity} un.`}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
