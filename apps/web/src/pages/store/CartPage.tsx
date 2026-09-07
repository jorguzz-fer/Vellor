import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CartItem } from '@/store/cart';
import type { ShippingService } from '@vellor/shared';
import { ArrowLeft, ArrowRight, ShieldCheck, ShoppingBag, Tag, Trash2, Truck } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ProductImage } from '@/components/ProductImage';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert, EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Input, QuantityInput, RadioCard } from '@/components/ui/form';
import { Price } from '@/components/ui/price';
import { t } from '@/i18n/pt-BR';
import { ApiError, checkoutApi } from '@/lib/api';
import { formatBRL, formatCEP, maskCepInput } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';
import { useCart } from '@/store/cart';

const CEP_ERROR = 'Informe um CEP válido com 8 dígitos.';

export default function CartPage() {
  usePageMeta(t('cart.title'));
  const cart = useCart();
  const { items } = cart;

  const [couponInput, setCouponInput] = useState('');
  const [cepInput, setCepInput] = useState(() => (cart.cep ? maskCepInput(cart.cep) : ''));
  const [cepError, setCepError] = useState<string | null>(null);
  const [stockNotice, setStockNotice] = useState(false);

  const quoteItems = useMemo(
    () => items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    [items],
  );
  const cepDigits = (cart.cep ?? '').replace(/\D/g, '');
  const cepReady = cepDigits.length === 8;
  const quoteInput = {
    items: quoteItems,
    couponCode: cart.couponCode ?? undefined,
    cep: cepReady ? cepDigits : undefined,
    shippingService: cart.shippingService ?? undefined,
  };

  const quoteQuery = useQuery({
    queryKey: ['checkout', 'quote', quoteInput],
    queryFn: () => checkoutApi.quote(quoteInput),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
  });
  const quote = quoteQuery.data;

  // Sincroniza estoque e preços com o servidor sempre que uma nova cotação chega.
  // Refs evitam que a própria sincronização dispare novas execuções do efeito.
  const itemsRef = useRef<CartItem[]>(items);
  itemsRef.current = items;
  const syncStockRef = useRef(cart.syncStock);
  syncStockRef.current = cart.syncStock;
  useEffect(() => {
    if (!quote) return;
    const byId = new Map(quote.items.map((q) => [q.variantId, q]));
    const current = itemsRef.current;
    const updates = current.map((item) => {
      const quoted = byId.get(item.variantId);
      return quoted
        ? {
            variantId: item.variantId,
            maxQuantity: quoted.availableQuantity,
            unitPriceCents: quoted.unitPriceCents,
          }
        : { variantId: item.variantId, maxQuantity: 0, unitPriceCents: item.unitPriceCents };
    });
    const changed = current.some((item, index) => {
      const u = updates[index]!;
      return u.maxQuantity < item.quantity || u.unitPriceCents !== item.unitPriceCents;
    });
    if (changed) setStockNotice(true);
    syncStockRef.current(updates);
  }, [quote]);

  const applyCoupon = (event: FormEvent) => {
    event.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    cart.setCoupon(code);
  };

  const removeCoupon = () => {
    cart.setCoupon(null);
    setCouponInput('');
  };

  const calculateShipping = (event: FormEvent) => {
    event.preventDefault();
    const digits = cepInput.replace(/\D/g, '');
    if (digits.length !== 8) {
      setCepError(CEP_ERROR);
      return;
    }
    setCepError(null);
    cart.setShipping(digits, cart.shippingService ?? 'PAC');
  };

  const chooseShipping = (service: string) => {
    if (!cepReady) return;
    cart.setShipping(cepDigits, service as ShippingService);
  };

  const quoteError = quoteQuery.error instanceof ApiError ? quoteQuery.error : null;
  const shippingError = quoteError?.code === 'invalid_cep' ? quoteError.message : null;
  const shippingOptions = quote?.shippingQuote?.options ?? [];
  const selectedShipping = quote?.shipping ?? null;
  const subtotalCents = quote?.subtotalCents ?? cart.subtotalCents;
  const discountCents = quote?.discountCents ?? 0;
  const totalCents = quote?.totalCents ?? cart.subtotalCents;
  const interestFree = quote
    ? [...quote.installments].reverse().find((o) => !o.hasInterest && o.count > 1)
    : undefined;
  const coupon = quote?.coupon ?? null;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title={t('cart.empty')}
          text={t('cart.emptyHint')}
          action={<LinkButton to="/relogios">{t('cart.browse')}</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">{t('nav.cart')}</span>
          <h1 className="heading mt-2 text-3xl">{t('cart.title')}</h1>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-muted">
          {cart.count} {cart.count === 1 ? t('cart.item') : t('cart.items')}
        </span>
      </div>

      {stockNotice && (
        <Alert tone="warning" className="mt-6">
          {t('cart.stockWarning')}
        </Alert>
      )}
      {quote && quote.warnings.length > 0 && (
        <Alert tone="warning" className="mt-4">
          <ul className="space-y-1">
            {quote.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      )}
      {quoteError && !shippingError && (
        <div className="mt-6">
          <ErrorState message={quoteError.message} onRetry={() => quoteQuery.refetch()} />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
        <section aria-label={t('order.items')}>
          <ul className="divide-y divide-line border-y border-line" data-testid="cart-page-items">
            {items.map((item) => (
              <li key={item.variantId} className="flex gap-4 py-5 sm:gap-6" data-testid="cart-item">
                <Link
                  to={`/produto/${item.slug}`}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-sm sm:h-32 sm:w-32"
                >
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.name}
                    kind={item.categoryKind}
                    className="absolute inset-0"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-sans text-sm font-semibold uppercase tracking-[0.12em] text-cream">
                        <Link to={`/produto/${item.slug}`} className="hover:text-gold">
                          {item.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-xs text-muted">{item.variantName}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 p-1 text-ivory/50 transition-colors hover:text-danger"
                      aria-label={`${t('common.remove')} ${item.name}`}
                      onClick={() => cart.remove(item.variantId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <span>{t('common.quantity').toLowerCase()} ×</span>
                    <Price cents={item.unitPriceCents} size="sm" />
                  </div>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                    <div>
                      <QuantityInput
                        value={item.quantity}
                        min={1}
                        max={item.maxQuantity}
                        onChange={(q) => cart.setQuantity(item.variantId, q)}
                      />
                      {item.quantity >= item.maxQuantity && (
                        <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-warning">
                          {t('cart.maxReached')}
                        </p>
                      )}
                    </div>
                    <span className="text-base font-medium tracking-wide text-gold">
                      {formatBRL(item.unitPriceCents * item.quantity)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <Link to="/relogios" className="btn-ghost px-0">
              <ArrowLeft className="h-4 w-4" />
              {t('cart.continueShopping')}
            </Link>
            <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
              <ShieldCheck className="h-4 w-4 text-gold" />
              {t('cart.secure')}
            </span>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            <form onSubmit={applyCoupon} className="card p-5" aria-label={t('cart.coupon')}>
              <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                <Tag className="h-4 w-4" />
                {t('cart.coupon')}
              </h2>
              {cart.couponCode ? (
                <div className="mt-4">
                  {!coupon || quoteQuery.isFetching ? (
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <Spinner size={14} />
                      <span className="font-semibold text-cream">{cart.couponCode}</span>
                    </div>
                  ) : coupon.valid ? (
                    <p className="text-sm text-success">
                      {t('cart.couponApplied')}:{' '}
                      <span className="font-semibold">{coupon.code}</span>
                      {coupon.description ? (
                        <span className="text-ivory/80"> · {coupon.description}</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-sm text-danger" role="alert">
                      <span className="font-semibold">{coupon.code}</span>:{' '}
                      {coupon.message ?? 'Cupom inválido'}
                    </p>
                  )}
                  <button type="button" onClick={removeCoupon} className="link mt-2 text-xs">
                    {t('cart.removeCoupon')}
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <Input
                    name="coupon"
                    aria-label={t('cart.couponPlaceholder')}
                    placeholder={t('cart.couponPlaceholder')}
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    autoComplete="off"
                    className="uppercase"
                    wrapperClassName="flex-1"
                  />
                  <Button type="submit" variant="secondary" disabled={!couponInput.trim()}>
                    {t('cart.applyCoupon')}
                  </Button>
                </div>
              )}
            </form>

            <form
              onSubmit={calculateShipping}
              className="card p-5"
              aria-label={t('cart.estimateShipping')}
            >
              <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                <Truck className="h-4 w-4" />
                {t('cart.estimateShipping')}
              </h2>
              <div className="mt-4 flex gap-2">
                <Input
                  name="cep"
                  aria-label={t('cart.cepPlaceholder')}
                  placeholder="00000-000"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={cepInput}
                  onChange={(e) => {
                    setCepInput(maskCepInput(e.target.value));
                    setCepError(null);
                  }}
                  error={cepError ?? shippingError ?? undefined}
                  wrapperClassName="flex-1"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  loading={cepReady && quoteQuery.isFetching}
                >
                  {t('cart.calculate')}
                </Button>
              </div>
              {cepReady && shippingOptions.length > 0 && (
                <div
                  className="mt-4 space-y-2"
                  role="radiogroup"
                  aria-label={t('checkout.shippingOptions')}
                >
                  <p className="text-xs text-muted">
                    CEP {formatCEP(cepDigits)}
                    {quote?.shippingQuote?.freeShipping ? ` · ${t('common.freeShipping')}` : ''}
                  </p>
                  {shippingOptions.map((option) => (
                    <RadioCard
                      key={option.service}
                      name="shipping"
                      value={option.service}
                      checked={selectedShipping?.service === option.service}
                      onChange={chooseShipping}
                      title={option.name}
                      description={`${t('checkout.shippingDeadline', { label: option.deadlineLabel })} · ${t('checkout.shippingInsured').toLowerCase()}`}
                      right={formatBRL(option.totalCents)}
                    />
                  ))}
                </div>
              )}
            </form>
          </div>
        </section>

        <aside className="lg:sticky lg:top-36 lg:self-start">
          <div className="card p-6">
            <h2 className="heading text-lg">{t('checkout.summary')}</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t('common.subtotal')}</dt>
                <dd className="text-cream">{formatBRL(subtotalCents)}</dd>
              </div>
              {discountCents > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">
                    {t('common.discount')}
                    {coupon?.valid ? (
                      <span className="ml-1 text-[10px] uppercase tracking-[0.15em] text-gold">
                        {coupon.code}
                      </span>
                    ) : null}
                  </dt>
                  <dd className="text-success">− {formatBRL(discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t('common.shipping')}</dt>
                <dd className="text-right text-cream">
                  {selectedShipping ? (
                    <>
                      {formatBRL(selectedShipping.totalCents)}
                      <span className="block text-[10px] uppercase tracking-[0.15em] text-muted">
                        {selectedShipping.service} · seguro{' '}
                        {formatBRL(selectedShipping.insuranceCents)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted">Informe o CEP para calcular</span>
                  )}
                </dd>
              </div>
              <div className="divider" />
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-xs font-bold uppercase tracking-[0.2em] text-cream">
                  {t('common.total')}
                </dt>
                <dd className="flex items-center gap-2 text-xl font-medium text-gold">
                  {quoteQuery.isFetching && <Spinner size={14} />}
                  {formatBRL(totalCents)}
                </dd>
              </div>
            </dl>
            {interestFree && (
              <p className="mt-2 text-right text-xs text-muted">
                {t('catalog.installmentsHint', {
                  count: interestFree.count,
                  value: formatBRL(interestFree.installmentCents),
                })}
              </p>
            )}
            {quote && quote.pixDiscountCents > 0 && (
              <p className="mt-1 text-right text-xs text-success">
                {t('checkout.pixDiscount')}: − {formatBRL(quote.pixDiscountCents)} ·{' '}
                {formatBRL(Math.max(0, totalCents - quote.pixDiscountCents))} no Pix
              </p>
            )}
            <Link to="/checkout" className="btn-primary mt-6 w-full" data-testid="go-checkout">
              {t('cart.checkout')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
              {t('checkout.shippingInsured')}. Pix, boleto ou cartão em ambiente seguro.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
