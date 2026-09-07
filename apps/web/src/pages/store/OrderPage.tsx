import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Order,
  type OrderEventType,
  type OrderStatus,
  PAYMENT_METHOD_LABELS,
  SHIPPING_SERVICE_LABELS,
} from '@vellor/shared';
import {
  Ban,
  Check,
  CircleDot,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  MapPin,
  Package,
  PackageCheck,
  QrCode,
  Truck,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ProductImage } from '@/components/ProductImage';
import { Button, LinkButton } from '@/components/ui/button';
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  PageLoader,
  useToast,
} from '@/components/ui/feedback';
import { t } from '@/i18n/pt-BR';
import { ApiError, checkoutApi, ordersApi } from '@/lib/api';
import { formatBRL, formatCEP, formatDateTime, formatPhoneBR, formatShortDate } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

const STATUS_TONE: Record<OrderStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  pending_payment: 'warning',
  paid: 'info',
  processing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'danger',
};

const EVENT_ICON: Record<OrderEventType, typeof Check> = {
  created: FileText,
  payment_pending: CircleDot,
  payment_confirmed: Check,
  payment_overdue: Ban,
  payment_refunded: Ban,
  processing: Package,
  shipped: Truck,
  delivered: PackageCheck,
  cancelled: Ban,
  note: FileText,
};

const POLL_INTERVAL_MS = 5_000;

function storageKeyFor(id: string): string {
  return `vellor:order-token:${id}`;
}

function readStoredToken(id: string): string | null {
  try {
    return sessionStorage.getItem(storageKeyFor(id));
  } catch {
    return null;
  }
}

function deadlineLabel(days: number): string {
  return `até ${days} dia${days === 1 ? '' : 's'} út${days === 1 ? 'il' : 'eis'}`;
}

export default function OrderPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('t');
  const simulateFlag = searchParams.get('simular') === '1';
  const token = useMemo(() => urlToken ?? readStoredToken(id), [urlToken, id]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!urlToken || !id) return;
    try {
      sessionStorage.setItem(storageKeyFor(id), urlToken);
    } catch {
      // sessionStorage indisponível: o token continua válido na URL
    }
  }, [urlToken, id]);

  const orderKey = ['order', id, token] as const;
  const orderQuery = useQuery({
    queryKey: orderKey,
    queryFn: () => ordersApi.get(id, token),
    enabled: Boolean(id),
  });
  const order = orderQuery.data;
  usePageMeta(order ? t('order.title', { number: order.number }) : 'Pedido');

  // Enquanto aguarda pagamento, consulta o status a cada 5s e recarrega o pedido quando mudar.
  const pending = order?.status === 'pending_payment';
  const statusQuery = useQuery({
    queryKey: [...orderKey, 'status'],
    queryFn: () => ordersApi.status(id, token),
    enabled: Boolean(id) && pending,
    refetchInterval: pending ? POLL_INTERVAL_MS : false,
  });
  const orderRef = useRef(order);
  orderRef.current = order;
  useEffect(() => {
    const status = statusQuery.data;
    const current = orderRef.current;
    if (!status || !current) return;
    if (status.status !== current.status || status.paymentStatus !== current.payment.status) {
      void queryClient.invalidateQueries({ queryKey: ['order', id], exact: false });
    }
  }, [statusQuery.data, queryClient, id]);

  const confirmMutation = useMutation({
    mutationFn: () => checkoutApi.mockConfirm(id, token ?? undefined),
    onSuccess: async () => {
      toast('Pagamento simulado confirmado.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['order', id], exact: false });
    },
    onError: (error) =>
      toast(error instanceof ApiError ? error.message : t('common.error'), 'danger'),
  });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('common.copied'), 'success');
    } catch {
      toast(
        'Não foi possível copiar automaticamente. Selecione o código e copie manualmente.',
        'danger',
      );
    }
  };

  if (!id) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <EmptyState
          title={t('order.notFound')}
          action={<LinkButton to="/">{t('common.backHome')}</LinkButton>}
        />
      </div>
    );
  }

  if (orderQuery.isLoading) {
    return <PageLoader />;
  }

  if (orderQuery.isError || !order) {
    const error = orderQuery.error;
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
          <EmptyState
            icon={<Package className="h-10 w-10" />}
            title={t('order.notFound')}
            text="Confira o link recebido por e-mail ou entre na sua conta para ver seus pedidos."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <LinkButton to="/conta/pedidos" variant="secondary">
                  {t('account.orders')}
                </LinkButton>
                <LinkButton to="/atendimento">{t('nav.contact')}</LinkButton>
              </div>
            }
          />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <ErrorState
          message={error instanceof ApiError ? error.message : undefined}
          onRetry={() => orderQuery.refetch()}
        />
      </div>
    );
  }

  const payment = order.payment;
  const isMockPix = payment.method === 'pix' && Boolean(payment.pix?.payload.includes('SIMULADO'));
  const isMockLink = Boolean(
    payment.boleto?.url.includes('simular=1') ||
    payment.creditCard?.checkoutUrl.includes('simular=1'),
  );
  const canSimulate = pending && (isMockPix || simulateFlag || isMockLink);
  const address = order.shippingAddress;
  const eyebrow =
    order.status === 'pending_payment' || order.status === 'paid'
      ? t('order.thanks')
      : t('order.timeline');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="heading mt-2 text-3xl">{t('order.title', { number: order.number })}</h1>
          <p className="mt-2 text-xs text-muted">
            {t('common.date')}: {formatDateTime(order.createdAt)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[order.status]} className="text-[11px]">
          {order.statusLabel}
        </Badge>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section className="card p-6" aria-labelledby="order-payment">
            <PaymentPanel order={order} onCopy={copy} />
            {canSimulate && (
              <div className="mt-6 border-t border-line pt-5">
                <Button
                  type="button"
                  variant="secondary"
                  loading={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate()}
                  data-testid="simulate-payment"
                >
                  {t('order.simulate')}
                </Button>
              </div>
            )}
          </section>

          <section className="card p-6" aria-labelledby="order-items">
            <h2 id="order-items" className="heading text-lg">
              {t('order.items')}
            </h2>
            <ul className="mt-4 divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm sm:h-20 sm:w-20">
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.name}
                      kind="other"
                      className="absolute inset-0"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-cream">
                      {item.productSlug ? (
                        <Link to={`/produto/${item.productSlug}`} className="hover:text-gold">
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {item.variantName} · {item.quantity} × {formatBRL(item.unitPriceCents)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gold">
                    {formatBRL(item.totalCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="card p-6">
              <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                <MapPin className="h-4 w-4" />
                {t('order.delivery')}
              </h2>
              <address className="mt-4 text-sm not-italic leading-relaxed text-ivory/90">
                {address.recipientName ?? order.customer.name}
                <br />
                {address.street}, {address.number}
                {address.complement ? ` – ${address.complement}` : ''}
                <br />
                {address.district} · {address.city}/{address.state}
                <br />
                CEP {formatCEP(address.cep)}
                {address.reference ? (
                  <>
                    <br />
                    <span className="text-muted">Ref.: {address.reference}</span>
                  </>
                ) : null}
              </address>
              <div className="mt-4 border-t border-line pt-4 text-sm">
                <p className="flex items-center gap-2 text-cream">
                  <Truck className="h-4 w-4 text-gold" />
                  {SHIPPING_SERVICE_LABELS[order.shippingService]}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t('checkout.shippingDeadline', {
                    label: deadlineLabel(order.shippingDeadlineDays),
                  })}
                </p>
              </div>
            </div>
            <div className="card p-6">
              <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                <CreditCard className="h-4 w-4" />
                {t('order.payment')}
              </h2>
              <p className="mt-4 text-sm text-cream">
                {PAYMENT_METHOD_LABELS[payment.method]}
                {payment.method === 'credit_card' && payment.installments > 1
                  ? ` · ${payment.installments}x de ${formatBRL(payment.installmentCents)}`
                  : ''}
              </p>
              {payment.paidAt && (
                <p className="mt-1 text-xs text-muted">Pago em {formatDateTime(payment.paidAt)}</p>
              )}
              <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
                <Row label="Nome">{order.customer.name}</Row>
                <Row label="E-mail">{order.customer.email}</Row>
                <Row label="Celular">{formatPhoneBR(order.customer.phone)}</Row>
                <Row label="CPF">{order.customer.cpfMasked}</Row>
              </dl>
              {order.notes && (
                <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
                  <span className="font-semibold uppercase tracking-[0.15em]">Observações:</span>{' '}
                  {order.notes}
                </p>
              )}
            </div>
          </section>

          <section className="card p-6" aria-labelledby="order-timeline">
            <h2 id="order-timeline" className="heading text-lg">
              {t('order.timeline')}
            </h2>
            <ol className="mt-5 space-y-5">
              {order.events.map((event, index) => {
                const Icon = EVENT_ICON[event.type] ?? CircleDot;
                const last = index === order.events.length - 1;
                return (
                  <li key={event.id} className="relative flex gap-4 pl-1">
                    {!last && (
                      <span
                        className="absolute left-[15px] top-8 h-[calc(100%-4px)] w-px bg-line"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${last ? 'border-gold bg-gold/10 text-gold' : 'border-line-strong bg-dark text-muted'}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm ${last ? 'text-cream' : 'text-ivory/80'}`}>
                        {event.message}
                      </p>
                      <time className="text-xs text-muted" dateTime={event.createdAt}>
                        {formatDateTime(event.createdAt)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="lg:sticky lg:top-36 lg:self-start">
          <div className="card p-6">
            <h2 className="heading text-lg">{t('checkout.summary')}</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t('common.subtotal')}</dt>
                <dd className="text-cream">{formatBRL(order.subtotalCents)}</dd>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">
                    {t('common.discount')}
                    {order.couponCode ? (
                      <span className="ml-1 text-[10px] uppercase tracking-[0.15em] text-gold">
                        {order.couponCode}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="text-success">− {formatBRL(order.discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Frete ({order.shippingService})</dt>
                <dd className="text-cream">
                  {order.shippingCents === 0
                    ? t('common.freeShipping')
                    : formatBRL(order.shippingCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Seguro do valor total</dt>
                <dd className="text-cream">{formatBRL(order.insuranceCents)}</dd>
              </div>
              <div className="divider" />
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-xs font-bold uppercase tracking-[0.2em] text-cream">
                  {t('common.total')}
                </dt>
                <dd className="text-xl font-medium text-gold">{formatBRL(order.totalCents)}</dd>
              </div>
            </dl>
            <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
              {t('order.help')}{' '}
              <Link to="/atendimento" className="link">
                {t('nav.contact')}
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ivory/90">{children}</dd>
    </div>
  );
}

function CopyBox({
  value,
  label,
  onCopy,
}: {
  value: string;
  label: string;
  onCopy: (text: string) => void;
}) {
  return (
    <div className="mt-3">
      <div
        className="max-h-32 overflow-auto rounded-sm border border-line-strong bg-noir p-3 font-mono text-xs leading-relaxed text-ivory/90 break-all select-all"
        tabIndex={0}
        aria-label={label}
      >
        {value}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-2"
        icon={<Copy className="h-3.5 w-3.5" />}
        onClick={() => onCopy(value)}
      >
        {label}
      </Button>
    </div>
  );
}

function PaymentPanel({ order, onCopy }: { order: Order; onCopy: (text: string) => void }) {
  const payment = order.payment;

  if (order.status === 'pending_payment') {
    const overdue = payment.status === 'overdue';
    const heading =
      payment.method === 'pix'
        ? t('order.payPix')
        : payment.method === 'boleto'
          ? t('order.payBoleto')
          : t('order.payCard');
    return (
      <div>
        <span className="eyebrow">{t('order.pending')}</span>
        <h2 id="order-payment" className="heading mt-2 text-2xl">
          {heading}
        </h2>
        {overdue && (
          <Alert tone="warning" className="mt-4">
            A cobrança venceu sem pagamento identificado. Fale com o atendimento para gerar uma
            nova.
          </Alert>
        )}

        {payment.method === 'pix' && payment.pix && (
          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr]">
            <div className="flex justify-center md:justify-start">
              {payment.pix.qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${payment.pix.qrCodeBase64}`}
                  alt="QR code do Pix"
                  width={224}
                  height={224}
                  className="h-56 w-56 rounded-sm bg-cream p-2"
                />
              ) : (
                <div
                  className="flex h-56 w-56 items-center justify-center rounded-sm border border-line bg-noir text-gold/60"
                  role="img"
                  aria-label="QR code indisponível"
                >
                  <QrCode className="h-16 w-16" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-ivory/90">{t('order.pixInstructions')}</p>
              <CopyBox value={payment.pix.payload} label={t('order.pixCopy')} onCopy={onCopy} />
              {payment.pix.expiresAt && (
                <p className="mt-3 text-xs text-warning">
                  {t('order.pixExpires', { time: formatDateTime(payment.pix.expiresAt) })}
                </p>
              )}
            </div>
          </div>
        )}

        {payment.method === 'boleto' && payment.boleto && (
          <div className="mt-5">
            <p className="text-sm text-ivory/90">
              {t('order.boletoDue', { date: formatShortDate(payment.boleto.dueDate) })}. A
              compensação leva até 2 dias úteis.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <LinkButton
                to={payment.boleto.url}
                external
                icon={<ExternalLink className="h-4 w-4" />}
              >
                {t('order.boletoOpen')}
              </LinkButton>
            </div>
            {payment.boleto.identificationField && (
              <CopyBox
                value={payment.boleto.identificationField}
                label={t('order.boletoCopy')}
                onCopy={onCopy}
              />
            )}
          </div>
        )}

        {payment.method === 'credit_card' && payment.creditCard && (
          <div className="mt-5">
            <p className="text-sm text-ivory/90">{t('order.cardText')}</p>
            <div className="mt-4">
              <LinkButton
                to={payment.creditCard.checkoutUrl}
                external
                icon={<CreditCard className="h-4 w-4" />}
              >
                {t('order.cardButton')}
              </LinkButton>
            </div>
          </div>
        )}

        {((payment.method === 'pix' && !payment.pix) ||
          (payment.method === 'boleto' && !payment.boleto) ||
          (payment.method === 'credit_card' && !payment.creditCard)) && (
          <p className="mt-4 text-sm text-muted">
            As instruções de pagamento estão sendo geradas. Você também as receberá por e-mail.
          </p>
        )}

        <p className="mt-5 flex items-center gap-2 text-xs text-muted">
          <CircleDot className="h-3.5 w-3.5 animate-pulse text-gold" />
          {t('order.waitingConfirmation')}
        </p>
      </div>
    );
  }

  if (order.status === 'paid' || order.status === 'processing') {
    return (
      <div>
        <span className="eyebrow">{order.statusLabel}</span>
        <h2 id="order-payment" className="heading mt-2 text-2xl">
          {t('order.paid')}
        </h2>
        <p className="mt-3 text-sm text-ivory/90">{t('order.paidText')}</p>
      </div>
    );
  }

  if (order.status === 'shipped') {
    return (
      <div>
        <span className="eyebrow">{order.statusLabel}</span>
        <h2 id="order-payment" className="heading mt-2 text-2xl">
          {t('order.shipped')}
        </h2>
        {order.trackingCode && (
          <div className="mt-4">
            <p className="label">{t('order.tracking')}</p>
            <p className="font-mono text-lg tracking-widest text-gold" data-testid="tracking-code">
              {order.trackingCode}
            </p>
          </div>
        )}
        {order.trackingUrl && (
          <div className="mt-4">
            <LinkButton to={order.trackingUrl} external icon={<ExternalLink className="h-4 w-4" />}>
              {t('order.track')}
            </LinkButton>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">
          {t('checkout.shippingDeadline', { label: deadlineLabel(order.shippingDeadlineDays) })}
        </p>
      </div>
    );
  }

  if (order.status === 'delivered') {
    return (
      <div>
        <span className="eyebrow">{order.statusLabel}</span>
        <h2 id="order-payment" className="heading mt-2 text-2xl">
          {t('order.delivered')}
        </h2>
        <p className="mt-3 text-sm text-ivory/90">
          Esperamos que aproveite sua peça. Trocas e devoluções podem ser solicitadas em até 7 dias
          após o recebimento.
        </p>
        {order.trackingCode && (
          <p className="mt-3 text-xs text-muted">
            {t('order.tracking')}: <span data-testid="tracking-code">{order.trackingCode}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <span className="eyebrow">{order.statusLabel}</span>
      <h2 id="order-payment" className="heading mt-2 text-2xl">
        {order.status === 'refunded' ? 'Pedido reembolsado' : t('order.cancelled')}
      </h2>
      <p className="mt-3 text-sm text-ivory/90">
        {order.status === 'refunded'
          ? 'O valor pago foi estornado pelo mesmo meio de pagamento. O prazo de crédito depende do banco emissor.'
          : 'Este pedido foi cancelado. Se houve pagamento, o estorno é feito automaticamente.'}
      </p>
    </div>
  );
}
