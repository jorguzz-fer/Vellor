import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AdminOrder,
  ORDER_ACTION_LABELS,
  ORDER_STATUS_LABELS,
  type OrderAction,
  type OrderActionInput,
  type OrderEventType,
  type OrderStatus,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
  SHIPPING_SERVICE_LABELS,
} from '@vellor/shared';
import { ArrowLeft, Copy, ExternalLink, Package, StickyNote, Truck, User } from 'lucide-react';
import { type ComponentProps, type FormEvent, type ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button, LinkButton } from '@/components/ui/button';
import { Badge, ErrorState, PageLoader, useToast } from '@/components/ui/feedback';
import { Input, Textarea } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { t } from '@/i18n/pt-BR';
import { ApiError, adminApi } from '@/lib/api';
import { formatBRL, formatCEP, formatCPF, formatDateTime, formatPhoneBR } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

type Tone = NonNullable<ComponentProps<typeof Badge>['tone']>;
type ButtonVariant = NonNullable<ComponentProps<typeof Button>['variant']>;

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

/** Transições permitidas pela API (OrdersService.applyAdminAction) para cada status. */
const ACTIONS_BY_STATUS: Record<OrderStatus, OrderAction[]> = {
  pending_payment: ['mark_paid', 'cancel'],
  paid: ['mark_processing', 'mark_shipped', 'cancel', 'mark_refunded'],
  processing: ['mark_shipped', 'cancel', 'mark_refunded'],
  shipped: ['mark_delivered', 'mark_refunded'],
  delivered: ['mark_refunded'],
  cancelled: [],
  refunded: [],
};

const ACTION_VARIANT: Record<OrderAction, ButtonVariant> = {
  mark_paid: 'primary',
  mark_processing: 'primary',
  mark_shipped: 'primary',
  mark_delivered: 'primary',
  cancel: 'danger',
  mark_refunded: 'danger',
  add_note: 'secondary',
};

const SUCCESS_MESSAGES: Record<OrderAction, string> = {
  mark_paid: 'Pagamento confirmado manualmente.',
  mark_processing: 'Pedido em separação.',
  mark_shipped: 'Pedido marcado como enviado.',
  mark_delivered: 'Entrega confirmada.',
  cancel: 'Pedido cancelado.',
  add_note: 'Observação registrada.',
  mark_refunded: 'Reembolso registrado.',
};

const EVENT_LABELS: Record<OrderEventType, string> = {
  created: 'Pedido criado',
  payment_pending: 'Aguardando pagamento',
  payment_confirmed: 'Pagamento confirmado',
  payment_overdue: 'Pagamento vencido',
  payment_refunded: 'Reembolso',
  processing: 'Em separação',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  note: 'Observação interna',
};

const EVENT_TONE: Record<OrderEventType, Tone> = {
  created: 'muted',
  payment_pending: 'warning',
  payment_confirmed: 'success',
  payment_overdue: 'danger',
  payment_refunded: 'danger',
  processing: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  note: 'gold',
};

const DOT_CLASS: Record<Tone, string> = {
  gold: 'bg-gold',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  muted: 'bg-line-strong',
};

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({ queryKey: ['admin', 'order', id], queryFn: () => adminApi.order(id), enabled: Boolean(id) });
  usePageMeta(query.data ? `Pedido ${query.data.number} · ${t('admin.title')}` : `${t('admin.orders')} · ${t('admin.title')}`);

  const [dialog, setDialog] = useState<OrderAction | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const closeDialog = () => {
    setDialog(null);
    setTrackingCode('');
    setNote('');
    setFieldError(null);
  };

  const mutation = useMutation({
    mutationFn: (input: OrderActionInput) => adminApi.orderAction(id, input),
    onSuccess: (order, input) => {
      queryClient.setQueryData(['admin', 'order', id], order);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      toast(SUCCESS_MESSAGES[input.action], 'success');
      closeDialog();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setFieldError(error.fieldError('trackingCode') ?? error.fieldError('note') ?? null);
        toast(error.message, 'danger');
      } else {
        toast('Não foi possível aplicar a ação. Tente novamente.', 'danger');
      }
    },
  });

  const run = (action: OrderAction, extra: Partial<OrderActionInput> = {}) => mutation.mutate({ action, ...extra });

  const onAction = (action: OrderAction) => {
    if (action === 'mark_processing' || action === 'mark_delivered') run(action);
    else setDialog(action);
  };

  const submitShipped = (event: FormEvent) => {
    event.preventDefault();
    const code = trackingCode.trim().toUpperCase();
    if (!code) {
      setFieldError('Informe o código de rastreio dos Correios');
      return;
    }
    run('mark_shipped', { trackingCode: code, note: note.trim() || undefined });
  };

  const submitNote = (event: FormEvent) => {
    event.preventDefault();
    const text = note.trim();
    if (!text) {
      setFieldError('Escreva a observação');
      return;
    }
    run('add_note', { note: text });
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copiado.`, 'success');
    } catch {
      toast('Não foi possível copiar.', 'danger');
    }
  };

  if (query.isPending) return <PageLoader />;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <ErrorState message={query.error instanceof ApiError ? query.error.message : undefined} onRetry={() => query.refetch()} />
        <div className="text-center">
          <LinkButton to="/admin/pedidos" variant="secondary">
            {t('common.back')}
          </LinkButton>
        </div>
      </div>
    );
  }

  const order = query.data;
  const available = ACTIONS_BY_STATUS[order.status];
  const address = order.shippingAddress;
  const addressText = [
    address.recipientName ?? order.customer.name,
    `${address.street}, ${address.number}${address.complement ? ` – ${address.complement}` : ''}`,
    address.district,
    `${address.city} – ${address.state}`,
    `CEP ${formatCEP(address.cep)}`,
  ].join('\n');
  const invoiceUrl = order.payment.creditCard?.checkoutUrl ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/pedidos" className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-gold">
            <ArrowLeft className="h-3.5 w-3.5" /> {t('admin.orders')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="heading text-2xl">{t('order.title', { number: order.number })}</h1>
            <Badge tone={STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Criado em {formatDateTime(order.createdAt)} · Atualizado em {formatDateTime(order.updatedAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t('common.total')}</p>
          <p className="font-display text-3xl text-gold">{formatBRL(order.totalCents)}</p>
        </div>
      </div>

      <section className="card p-4" aria-label="Ações do pedido">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t('common.actions')}</span>
          {available.map((action) => (
            <Button key={action} variant={ACTION_VARIANT[action]} size="sm" onClick={() => onAction(action)} disabled={mutation.isPending} data-testid={`order-action-${action}`}>
              {ORDER_ACTION_LABELS[action]}
            </Button>
          ))}
          <Button variant="secondary" size="sm" icon={<StickyNote className="h-3.5 w-3.5" />} onClick={() => onAction('add_note')} disabled={mutation.isPending} data-testid="order-action-add_note">
            {ORDER_ACTION_LABELS.add_note}
          </Button>
          {available.length === 0 && <span className="text-xs text-muted">Pedido {ORDER_STATUS_LABELS[order.status].toLowerCase()}: nenhuma outra transição disponível.</span>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ItemsCard order={order} />

          <div className="grid gap-6 md:grid-cols-2">
            <section className="card p-5" aria-label="Cliente">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="heading inline-flex items-center gap-2 text-lg">
                  <User className="h-4 w-4 text-gold" /> Cliente
                </h2>
                {order.userId ? (
                  <Link to={`/admin/clientes/${order.userId}`} className="link text-xs uppercase tracking-[0.15em]">
                    Ver cadastro
                  </Link>
                ) : (
                  <Badge tone="muted">Visitante</Badge>
                )}
              </div>
              <dl className="space-y-3 text-sm">
                <Row label="Nome">{order.customer.name}</Row>
                <Row label={t('account.email')}>
                  <a href={`mailto:${order.customer.email}`} className="link break-all">
                    {order.customer.email}
                  </a>
                </Row>
                <Row label={t('account.phone')}>
                  <a href={`tel:+55${order.customer.phone.replace(/\D/g, '')}`} className="link">
                    {formatPhoneBR(order.customer.phone)}
                  </a>
                </Row>
                <Row label={t('account.cpf')}>
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono">{formatCPF(order.customer.cpf)}</span>
                    <CopyButton onClick={() => copy(order.customer.cpf.replace(/\D/g, ''), 'CPF')} label="Copiar CPF" />
                  </span>
                </Row>
              </dl>
            </section>

            <section className="card p-5" aria-label="Endereço de entrega">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="heading inline-flex items-center gap-2 text-lg">
                  <Truck className="h-4 w-4 text-gold" /> {t('order.delivery')}
                </h2>
                <CopyButton onClick={() => copy(addressText, 'Endereço')} label="Copiar endereço" />
              </div>
              <address className="space-y-0.5 text-sm not-italic text-ivory/90">
                <p className="text-cream">{address.recipientName ?? order.customer.name}</p>
                <p>
                  {address.street}, {address.number}
                  {address.complement ? ` – ${address.complement}` : ''}
                </p>
                <p>{address.district}</p>
                <p>
                  {address.city} – {address.state}
                </p>
                <p>CEP {formatCEP(address.cep)}</p>
                {address.reference && <p className="pt-1 text-xs text-muted">Ref.: {address.reference}</p>}
              </address>
            </section>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="card p-5" aria-label="Observações do cliente">
              <h2 className="heading mb-3 text-lg">Observações do cliente</h2>
              {order.notes ? <p className="whitespace-pre-line text-sm text-ivory/90">{order.notes}</p> : <p className="text-sm text-muted">Nenhuma observação.</p>}
            </section>
            <section className="card p-5" aria-label="Notas internas">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="heading text-lg">Notas internas</h2>
                <button type="button" className="link text-xs uppercase tracking-[0.15em]" onClick={() => onAction('add_note')}>
                  Adicionar
                </button>
              </div>
              {order.internalNotes ? (
                <p className="whitespace-pre-line font-mono text-xs leading-relaxed text-ivory/90">{order.internalNotes}</p>
              ) : (
                <p className="text-sm text-muted">Nenhuma nota interna.</p>
              )}
            </section>
          </div>

          <Timeline events={order.events} />
        </div>

        <div className="space-y-6">
          <section className="card p-5" aria-label="Valores">
            <h2 className="heading mb-4 text-lg">Valores</h2>
            <dl className="space-y-2 text-sm">
              <Money label={t('common.subtotal')} cents={order.subtotalCents} />
              {order.discountCents > 0 && (
                <Money
                  label={
                    <span className="inline-flex items-center gap-2">
                      {t('common.discount')}
                      {order.couponCode && <Badge tone="gold">{order.couponCode}</Badge>}
                    </span>
                  }
                  cents={-order.discountCents}
                  className="text-success"
                />
              )}
              <Money label="Frete" cents={order.shippingCents} />
              <Money label="Seguro" cents={order.insuranceCents} />
              <div className="divider my-2" />
              <Money label={t('common.total')} cents={order.totalCents} className="font-display text-xl text-gold" />
            </dl>
          </section>

          <section className="card p-5" aria-label="Pagamento">
            <h2 className="heading mb-4 text-lg">{t('order.payment')}</h2>
            <dl className="space-y-3 text-sm">
              <Row label="Forma">{PAYMENT_METHOD_LABELS[order.payment.method]}</Row>
              <Row label="Situação">
                <Badge tone={PAYMENT_TONE[order.payment.status]}>{PAYMENT_STATUS_LABELS[order.payment.status]}</Badge>
              </Row>
              <Row label={t('checkout.installments')}>
                {order.payment.installments > 1 ? `${order.payment.installments}x de ${formatBRL(order.payment.installmentCents)}` : 'À vista'}
              </Row>
              {order.payment.paidAt && <Row label="Pago em">{formatDateTime(order.payment.paidAt)}</Row>}
              {order.payment.boleto?.dueDate && <Row label="Vencimento do boleto">{formatDateTime(order.payment.boleto.dueDate)}</Row>}
              {order.payment.pix?.expiresAt && <Row label="Pix válido até">{formatDateTime(order.payment.pix.expiresAt)}</Row>}
              <Row label="ID no provedor">
                {order.providerPaymentId ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="break-all font-mono text-xs">{order.providerPaymentId}</span>
                    <CopyButton onClick={() => copy(order.providerPaymentId ?? '', 'ID do pagamento')} label="Copiar ID do pagamento" />
                  </span>
                ) : (
                  '—'
                )}
              </Row>
              {order.providerCustomerId && (
                <Row label="Cliente no provedor">
                  <span className="break-all font-mono text-xs">{order.providerCustomerId}</span>
                </Row>
              )}
            </dl>
            {(invoiceUrl || order.payment.boleto?.url) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {invoiceUrl && (
                  <a href={invoiceUrl} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-2 text-[10px]">
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir fatura
                  </a>
                )}
                {order.payment.boleto?.url && (
                  <a href={order.payment.boleto.url} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-2 text-[10px]">
                    <ExternalLink className="h-3.5 w-3.5" /> {t('order.boletoOpen')}
                  </a>
                )}
              </div>
            )}
          </section>

          <section className="card p-5" aria-label="Envio">
            <h2 className="heading mb-4 text-lg">Envio</h2>
            <dl className="space-y-3 text-sm">
              <Row label="Serviço">{SHIPPING_SERVICE_LABELS[order.shippingService]}</Row>
              <Row label="Prazo">{order.shippingDeadlineDays} dias úteis após a postagem</Row>
              <Row label={t('order.tracking')}>
                {order.trackingCode ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono">{order.trackingCode}</span>
                    <CopyButton onClick={() => copy(order.trackingCode ?? '', 'Código de rastreio')} label="Copiar código de rastreio" />
                  </span>
                ) : (
                  <span className="text-muted">Ainda não postado</span>
                )}
              </Row>
            </dl>
            {order.trackingUrl && (
              <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="btn-secondary mt-4 px-3 py-2 text-[10px]">
                <ExternalLink className="h-3.5 w-3.5" /> {t('order.track')}
              </a>
            )}
          </section>
        </div>
      </div>

      {/* ---------- Diálogos de ação ---------- */}

      <Modal
        open={dialog === 'mark_shipped'}
        onClose={closeDialog}
        title={ORDER_ACTION_LABELS.mark_shipped}
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeDialog} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="order-ship-form" loading={mutation.isPending} data-testid="order-action-confirm">
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <form id="order-ship-form" onSubmit={submitShipped} noValidate className="space-y-4">
          <p className="text-sm text-ivory/80">O cliente receberá um e-mail com o código de rastreio e o pedido passará para "Enviado".</p>
          <Input
            label="Código de rastreio dos Correios"
            name="trackingCode"
            required
            autoFocus
            maxLength={40}
            placeholder="Ex.: AA123456789BR"
            value={trackingCode}
            onChange={(e) => {
              setTrackingCode(e.target.value.toUpperCase());
              setFieldError(null);
            }}
            error={fieldError ?? undefined}
            className="font-mono uppercase"
            data-testid="tracking-input"
          />
          <Textarea label="Observação" name="shipNote" hint={t('common.optional')} maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </form>
      </Modal>

      <Modal
        open={dialog === 'add_note'}
        onClose={closeDialog}
        title={ORDER_ACTION_LABELS.add_note}
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeDialog} disabled={mutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="order-note-form" loading={mutation.isPending} data-testid="order-action-confirm">
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="order-note-form" onSubmit={submitNote} noValidate className="space-y-4">
          <Textarea
            label="Observação interna"
            name="note"
            hint="Visível apenas para a equipe; fica registrada na linha do tempo do pedido."
            required
            autoFocus
            maxLength={500}
            rows={4}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setFieldError(null);
            }}
            error={fieldError ?? undefined}
            data-testid="note-input"
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={dialog === 'mark_paid'}
        onClose={closeDialog}
        onConfirm={() => run('mark_paid')}
        title={ORDER_ACTION_LABELS.mark_paid}
        confirmLabel="Confirmar pagamento"
        loading={mutation.isPending}
        text={
          <p>
            Use apenas quando o pagamento foi recebido fora do sistema (ex.: transferência conferida no extrato). O estoque será baixado e o cliente receberá o e-mail de
            confirmação do pedido <strong className="text-cream">{order.number}</strong>.
          </p>
        }
      />

      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={closeDialog}
        onConfirm={() => run('cancel', { note: note.trim() || undefined })}
        title={ORDER_ACTION_LABELS.cancel}
        confirmLabel="Cancelar pedido"
        danger
        loading={mutation.isPending}
        text={
          <div className="space-y-4">
            <p>
              O pedido <strong className="text-cream">{order.number}</strong> será cancelado, o estoque liberado e o cliente avisado por e-mail. Cobranças pendentes são
              canceladas no provedor. Esta ação não pode ser desfeita.
            </p>
            <Textarea label="Motivo" name="cancelReason" hint={t('common.optional')} maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} data-testid="reason-input" />
          </div>
        }
      />

      <ConfirmDialog
        open={dialog === 'mark_refunded'}
        onClose={closeDialog}
        onConfirm={() => run('mark_refunded', { note: note.trim() || undefined })}
        title={ORDER_ACTION_LABELS.mark_refunded}
        confirmLabel="Registrar reembolso"
        danger
        loading={mutation.isPending}
        text={
          <div className="space-y-4">
            <p>
              Registra que o valor de <strong className="text-cream">{formatBRL(order.totalCents)}</strong> foi devolvido ao cliente. O estorno em si deve ser feito no
              provedor de pagamento; aqui o pedido passa para "Reembolsado" e o estoque é liberado.
            </p>
            <Textarea label="Motivo" name="refundReason" hint={t('common.optional')} maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} data-testid="reason-input" />
          </div>
        }
      />
    </div>
  );
}

// ---------- Blocos ----------

function ItemsCard({ order }: { order: AdminOrder }) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <section className="card" aria-label="Itens do pedido">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="heading text-lg">{t('order.items')}</h2>
        <span className="text-xs text-muted">
          {count} {count === 1 ? t('cart.item') : t('cart.items')}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="text-right">Qtd.</th>
              <th className="text-right">Unitário</th>
              <th className="text-right">{t('common.total')}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-sm bg-noir object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-noir text-muted" aria-hidden="true">
                        <Package className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0">
                      {item.productId ? (
                        <Link to={`/admin/produtos/${item.productId}`} className="block font-medium text-cream hover:text-gold">
                          {item.name}
                        </Link>
                      ) : (
                        <span className="block font-medium text-cream">{item.name}</span>
                      )}
                      <span className="block text-xs text-muted">
                        {item.variantName} · {t('catalog.sku')} <span className="font-mono">{item.sku}</span>
                      </span>
                      {item.productSlug && (
                        <a href={`/produto/${item.productSlug}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-muted hover:text-gold">
                          <ExternalLink className="h-3 w-3" /> Ver na loja
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="text-right">{item.quantity}</td>
                <td className="whitespace-nowrap text-right text-ivory/80">{formatBRL(item.unitPriceCents)}</td>
                <td className="whitespace-nowrap text-right font-medium">{formatBRL(item.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Timeline({ events }: { events: AdminOrder['events'] }) {
  return (
    <section className="card p-5" aria-label="Linha do tempo">
      <h2 className="heading mb-4 text-lg">{t('order.timeline')}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted">Nenhum evento registrado.</p>
      ) : (
        <ol className="relative space-y-5 border-l border-line pl-5">
          {events.map((event) => {
            const tone = EVENT_TONE[event.type];
            return (
              <li key={event.id} className="relative">
                <span className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-dark ${DOT_CLASS[tone]}`} aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={tone}>{EVENT_LABELS[event.type]}</Badge>
                  <time dateTime={event.createdAt} className="text-xs text-muted">
                    {formatDateTime(event.createdAt)}
                  </time>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm text-ivory/90">{event.message}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{label}</dt>
      <dd className="min-w-0 text-ivory/90 sm:text-right">{children}</dd>
    </div>
  );
}

function Money({ label, cents, className = '' }: { label: ReactNode; cents: number; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ivory/80">{label}</dt>
      <dd className={`whitespace-nowrap font-medium ${className}`}>{cents < 0 ? `− ${formatBRL(-cents)}` : formatBRL(cents)}</dd>
    </div>
  );
}

function CopyButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="rounded p-1 text-muted transition-colors hover:text-gold" aria-label={label} title={label}>
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}
