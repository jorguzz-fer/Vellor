import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { CartItem } from '@/store/cart';
import {
  type Address,
  BRAZIL_STATES,
  CheckoutInputSchema,
  DEFAULT_STORE_SETTINGS,
  type PaymentMethod,
  type ShippingService,
} from '@vellor/shared';
import { Lock, ShieldCheck } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ProductImage } from '@/components/ProductImage';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert, ErrorState, Spinner } from '@/components/ui/feedback';
import { Checkbox, Input, RadioCard, Select, Textarea } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { accountApi, ApiError, checkoutApi } from '@/lib/api';
import { formatBRL, formatCEP, maskCepInput, maskCpfInput, maskPhoneInput } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';
import { useAuth, useSettings } from '@/lib/queries';
import { useCart } from '@/store/cart';

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

interface AddressForm {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  reference: string;
  recipientName: string;
}

const EMPTY_CUSTOMER: CustomerForm = { name: '', email: '', phone: '', cpf: '' };
const EMPTY_ADDRESS: AddressForm = {
  cep: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  reference: '',
  recipientName: '',
};
const STATE_OPTIONS = BRAZIL_STATES.map((uf) => ({ value: uf, label: uf }));
const PAYMENT_METHODS: PaymentMethod[] = ['pix', 'boleto', 'credit_card'];
const STOCK_ERROR_CODES = new Set(['items_unavailable', 'insufficient_stock']);

type FieldErrors = Record<string, string | undefined>;

export default function CheckoutPage() {
  usePageMeta(t('checkout.title'));
  const cart = useCart();
  const { items } = cart;
  const auth = useAuth();
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const payments = settings?.payments ?? DEFAULT_STORE_SETTINGS.payments;

  const [customer, setCustomer] = useState<CustomerForm>(EMPTY_CUSTOMER);
  const [address, setAddress] = useState<AddressForm>(() => ({
    ...EMPTY_ADDRESS,
    cep: cart.cep ? maskCepInput(cart.cep) : '',
  }));
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [cepPartial, setCepPartial] = useState(false);
  const [shippingService, setShippingService] = useState<ShippingService | null>(
    cart.shippingService,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [installments, setInstallments] = useState(1);
  const [couponInput, setCouponInput] = useState('');
  const [notes, setNotes] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{ message: string; code: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  /** Último CEP cujo resultado já foi aplicado ao formulário (evita sobrescrever edições manuais). */
  const filledCepRef = useRef<string | null>(null);

  const clearError = (...keys: string[]) => {
    setErrors((prev) => {
      if (!keys.some((k) => prev[k])) return prev;
      const next = { ...prev };
      for (const k of keys) next[k] = undefined;
      return next;
    });
  };
  const setCustomerField = (field: keyof CustomerForm, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
    clearError(`customer.${field}`);
  };
  const setAddressField = (field: keyof AddressForm, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    clearError(`shippingAddress.${field}`);
  };

  // ---------- Identificação: pré-preenche com os dados da conta ----------
  const user = auth.authenticated ? auth.user : null;
  useEffect(() => {
    if (!user) return;
    setCustomer((prev) => ({
      ...prev,
      name: prev.name || user.name,
      email: prev.email || user.email,
      phone: prev.phone || (user.phone ? maskPhoneInput(user.phone) : ''),
    }));
  }, [user]);

  // ---------- Endereços salvos ----------
  const addressesQuery = useQuery({
    queryKey: ['account', 'addresses'],
    queryFn: accountApi.addresses,
    enabled: auth.authenticated,
  });
  const savedAddresses = useMemo(
    () => (auth.authenticated ? (addressesQuery.data ?? []) : []),
    [auth.authenticated, addressesQuery.data],
  );
  const usingSaved = selectedAddressId !== null && selectedAddressId !== 'new';

  const applySavedAddress = (saved: Address) => {
    setAddress({
      cep: maskCepInput(saved.cep),
      street: saved.street,
      number: saved.number,
      complement: saved.complement ?? '',
      district: saved.district,
      city: saved.city,
      state: saved.state,
      reference: saved.reference ?? '',
      recipientName: saved.recipientName ?? '',
    });
    setCepPartial(false);
    clearError(...Object.keys(EMPTY_ADDRESS).map((k) => `shippingAddress.${k}`));
  };

  useEffect(() => {
    if (selectedAddressId !== null || savedAddresses.length === 0) return;
    const preferred = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0]!;
    setSelectedAddressId(preferred.id);
    applySavedAddress(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses, selectedAddressId]);

  const chooseAddress = (value: string) => {
    setSelectedAddressId(value);
    if (value === 'new') {
      setAddress({ ...EMPTY_ADDRESS, cep: '' });
      filledCepRef.current = null;
      setCepPartial(false);
      return;
    }
    const saved = savedAddresses.find((a) => a.id === value);
    if (saved) applySavedAddress(saved);
  };

  // ---------- CEP: busca automática do endereço ----------
  const cepDigits = address.cep.replace(/\D/g, '');
  const cepValid = cepDigits.length === 8;
  const cepQuery = useQuery({
    queryKey: ['cep', cepDigits],
    queryFn: () => checkoutApi.cep(cepDigits),
    enabled: cepValid && !usingSaved,
    staleTime: Infinity,
  });
  useEffect(() => {
    const data = cepQuery.data;
    if (!data || usingSaved || filledCepRef.current === data.cep) return;
    filledCepRef.current = data.cep;
    setCepPartial(data.partial);
    setAddress((prev) => ({
      ...prev,
      street: data.street || prev.street,
      district: data.district || prev.district,
      city: data.city || prev.city,
      state: data.state || prev.state,
    }));
    clearError(
      'shippingAddress.street',
      'shippingAddress.district',
      'shippingAddress.city',
      'shippingAddress.state',
    );
  }, [cepQuery.data, usingSaved]);

  // ---------- Frete ----------
  const quoteItems = useMemo(
    () => items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    [items],
  );
  const shippingQuery = useQuery({
    queryKey: ['checkout', 'shipping-quote', cepDigits, quoteItems],
    queryFn: () => checkoutApi.shippingQuote({ cep: cepDigits, items: quoteItems }),
    enabled: cepValid && quoteItems.length > 0,
    placeholderData: keepPreviousData,
  });
  const shippingOptions = useMemo(
    () => (cepValid ? (shippingQuery.data?.options ?? []) : []),
    [cepValid, shippingQuery.data],
  );

  const setShippingRef = useRef(cart.setShipping);
  setShippingRef.current = cart.setShipping;
  useEffect(() => {
    if (shippingOptions.length === 0) return;
    if (shippingService && shippingOptions.some((o) => o.service === shippingService)) return;
    const first = shippingOptions[0]!;
    setShippingService(first.service);
    setShippingRef.current(cepDigits, first.service);
  }, [shippingOptions, shippingService, cepDigits]);

  const chooseShipping = (service: ShippingService) => {
    setShippingService(service);
    clearError('shippingService');
    if (cepValid) cart.setShipping(cepDigits, service);
  };

  // ---------- Cotação completa (resumo) ----------
  const quoteInput = {
    items: quoteItems,
    couponCode: cart.couponCode ?? undefined,
    cep: cepValid ? cepDigits : undefined,
    shippingService: shippingService ?? undefined,
  };
  const quoteQuery = useQuery({
    queryKey: ['checkout', 'quote', quoteInput],
    queryFn: () => checkoutApi.quote(quoteInput),
    enabled: quoteItems.length > 0,
    placeholderData: keepPreviousData,
  });
  const quote = quoteQuery.data;

  const itemsRef = useRef<CartItem[]>(items);
  itemsRef.current = items;
  const syncStockRef = useRef(cart.syncStock);
  syncStockRef.current = cart.syncStock;
  useEffect(() => {
    if (!quote) return;
    const byId = new Map(quote.items.map((q) => [q.variantId, q]));
    syncStockRef.current(
      itemsRef.current.map((item) => {
        const quoted = byId.get(item.variantId);
        return quoted
          ? {
              variantId: item.variantId,
              maxQuantity: quoted.availableQuantity,
              unitPriceCents: quoted.unitPriceCents,
            }
          : { variantId: item.variantId, maxQuantity: 0, unitPriceCents: item.unitPriceCents };
      }),
    );
  }, [quote]);

  const installmentOptions = quote?.installments ?? [];
  const validInstallments = installmentOptions.some((o) => o.count === installments)
    ? installments
    : 1;
  const chosenInstallment = installmentOptions.find((o) => o.count === validInstallments) ?? null;

  const subtotalCents = quote?.subtotalCents ?? cart.subtotalCents;
  const discountCents = quote?.discountCents ?? 0;
  const shippingSelected = quote?.shipping ?? null;
  const pixDiscountCents = paymentMethod === 'pix' ? (quote?.pixDiscountCents ?? 0) : 0;
  const totalCents = quote ? Math.max(0, quote.totalCents - pixDiscountCents) : cart.subtotalCents;
  const coupon = quote?.coupon ?? null;

  const applyCoupon = (event: FormEvent) => {
    event.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    cart.setCoupon(code);
    clearError('couponCode');
  };

  // ---------- Conclusão ----------
  const placeOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const raw = {
      items: quoteItems,
      customer: { ...customer },
      shippingAddress: {
        recipientName: address.recipientName.trim() || undefined,
        cep: address.cep,
        street: address.street,
        number: address.number,
        complement: address.complement.trim() || null,
        district: address.district,
        city: address.city,
        state: address.state,
        reference: address.reference.trim() || null,
      },
      shippingService: shippingService ?? undefined,
      payment: {
        method: paymentMethod,
        installments: paymentMethod === 'credit_card' ? validInstallments : 1,
      },
      couponCode: cart.couponCode ?? undefined,
      notes: notes.trim() || undefined,
      acceptTerms,
      saveAddress: auth.authenticated && !usingSaved ? saveAddress : undefined,
    };
    const parsed = CheckoutInputSchema.safeParse(raw);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join('.') || '_';
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setFormError({
        message: 'Revise os campos destacados para concluir o pedido.',
        code: 'validation',
      });
      window.setTimeout(() => {
        const invalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        (invalid ?? errorRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        invalid?.focus({ preventScroll: true });
      }, 0);
      return;
    }
    setSubmitting(true);
    try {
      const result = await checkoutApi.placeOrder(parsed.data);
      try {
        sessionStorage.setItem(`vellor:order-token:${result.orderId}`, result.accessToken);
      } catch {
        // sessionStorage indisponível: o token segue na URL
      }
      cart.clear();
      navigate(`/pedido/${result.orderId}?t=${encodeURIComponent(result.accessToken)}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError({ message: error.message, code: error.code });
        if (error.errors) {
          const next: FieldErrors = {};
          for (const [field, messages] of Object.entries(error.errors)) next[field] = messages[0];
          setErrors((prev) => ({ ...prev, ...next }));
        }
        if (STOCK_ERROR_CODES.has(error.code)) void quoteQuery.refetch();
      } else {
        setFormError({ message: t('common.error'), code: 'unknown' });
      }
      setSubmitting(false);
      window.setTimeout(
        () => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        0,
      );
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <span className="eyebrow">{t('checkout.title')}</span>
        <h1 className="heading mt-2 text-3xl">{t('checkout.title')}</h1>
        <div className="card mt-8 flex flex-col items-start gap-5 p-6">
          <p className="text-sm text-ivory/80">{t('checkout.emptyCart')}</p>
          <LinkButton to="/relogios">{t('nav.watches')}</LinkButton>
        </div>
      </div>
    );
  }

  const shippingError = shippingQuery.error instanceof ApiError ? shippingQuery.error : null;
  const cepLookupFailed = cepValid && !usingSaved && cepQuery.isError;
  const stockProblem = formError
    ? STOCK_ERROR_CODES.has(formError.code) || Boolean(errors.items)
    : false;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">{t('checkout.title')}</span>
          <h1 className="heading mt-2 text-3xl">{t('checkout.title')}</h1>
        </div>
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
          <Lock className="h-4 w-4 text-gold" />
          {t('cart.secure')}
        </span>
      </div>

      {quote && quote.warnings.length > 0 && (
        <Alert tone="warning" className="mt-6">
          <ul className="space-y-1">
            {quote.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <Link to="/sacola" className="link mt-2 inline-block text-xs">
            Revisar sacola
          </Link>
        </Alert>
      )}

      <form
        onSubmit={placeOrder}
        noValidate
        className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]"
      >
        <div className="space-y-10">
          {/* 1. Identificação */}
          <section aria-labelledby="step-identification">
            <SectionHeader
              step={1}
              id="step-identification"
              title={t('checkout.stepIdentification')}
            />
            <p className="mt-4 text-sm text-muted">
              {user ? (
                <>
                  Comprando como <span className="text-cream">{user.name}</span> ({user.email}).
                </>
              ) : (
                <>
                  {t('checkout.guestHint')}{' '}
                  <Link to="/conta/entrar?next=/checkout" className="link">
                    {t('checkout.loginLink')}
                  </Link>
                  .
                </>
              )}
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t('checkout.name')}
                name="name"
                autoComplete="name"
                required
                value={customer.name}
                onChange={(e) => setCustomerField('name', e.target.value)}
                error={errors['customer.name']}
                wrapperClassName="sm:col-span-2"
                data-testid="checkout-name"
              />
              <Input
                label={t('checkout.email')}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={customer.email}
                onChange={(e) => setCustomerField('email', e.target.value)}
                error={errors['customer.email']}
                data-testid="checkout-email"
              />
              <Input
                label={t('checkout.phone')}
                name="phone"
                type="tel"
                autoComplete="tel-national"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                required
                value={customer.phone}
                onChange={(e) => setCustomerField('phone', maskPhoneInput(e.target.value))}
                error={errors['customer.phone']}
                data-testid="checkout-phone"
              />
              <Input
                label={t('checkout.cpf')}
                name="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                required
                value={customer.cpf}
                onChange={(e) => setCustomerField('cpf', maskCpfInput(e.target.value))}
                error={errors['customer.cpf']}
                hint={t('checkout.cpfHint')}
                data-testid="checkout-cpf"
              />
            </div>
          </section>

          {/* 2. Entrega */}
          <section aria-labelledby="step-address">
            <SectionHeader step={2} id="step-address" title={t('checkout.stepAddress')} />
            {auth.authenticated && addressesQuery.isLoading && (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <Spinner size={14} /> Carregando endereços salvos…
              </div>
            )}
            {savedAddresses.length > 0 && (
              <div
                className="mt-5 space-y-2"
                role="radiogroup"
                aria-label={t('checkout.useSavedAddress')}
              >
                <p className="label">{t('checkout.useSavedAddress')}</p>
                {savedAddresses.map((saved) => (
                  <RadioCard
                    key={saved.id}
                    name="savedAddress"
                    value={saved.id}
                    checked={selectedAddressId === saved.id}
                    onChange={chooseAddress}
                    title={
                      <>
                        {saved.label ? `${saved.label} · ` : ''}
                        {saved.street}, {saved.number}
                        {saved.complement ? ` – ${saved.complement}` : ''}
                      </>
                    }
                    description={`${saved.district} · ${saved.city}/${saved.state} · CEP ${formatCEP(saved.cep)}`}
                    right={saved.isDefault ? t('account.defaultAddress') : undefined}
                  />
                ))}
                <RadioCard
                  name="savedAddress"
                  value="new"
                  checked={selectedAddressId === 'new'}
                  onChange={chooseAddress}
                  title={t('checkout.newAddress')}
                />
              </div>
            )}

            {usingSaved ? (
              <p className="mt-4 text-xs text-muted">
                Entrega para {address.recipientName || customer.name || 'você'} em {address.street},{' '}
                {address.number}
                {address.complement ? ` – ${address.complement}` : ''} · {address.district} ·{' '}
                {address.city}/{address.state} · CEP {formatCEP(address.cep)}
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-6">
                <Input
                  label={t('checkout.cep')}
                  name="cep"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  required
                  value={address.cep}
                  onChange={(e) => {
                    const masked = maskCepInput(e.target.value);
                    if (masked.replace(/\D/g, '').length < 8) filledCepRef.current = null;
                    setAddressField('cep', masked);
                    setCepPartial(false);
                  }}
                  error={errors['shippingAddress.cep']}
                  hint={cepValid && cepQuery.isFetching ? 'Buscando endereço…' : undefined}
                  wrapperClassName="sm:col-span-2"
                  data-testid="checkout-cep"
                />
                <div className="sm:col-span-4">
                  {(cepPartial || cepLookupFailed) && (
                    <Alert tone="warning">
                      Não foi possível localizar o endereço deste CEP. Preencha os campos
                      manualmente.
                    </Alert>
                  )}
                </div>
                <Input
                  label={t('checkout.street')}
                  name="street"
                  autoComplete="address-line1"
                  required
                  value={address.street}
                  onChange={(e) => setAddressField('street', e.target.value)}
                  error={errors['shippingAddress.street']}
                  wrapperClassName="sm:col-span-4"
                  data-testid="checkout-street"
                />
                <Input
                  label={t('checkout.number')}
                  name="number"
                  required
                  value={address.number}
                  onChange={(e) => setAddressField('number', e.target.value)}
                  error={errors['shippingAddress.number']}
                  wrapperClassName="sm:col-span-2"
                  data-testid="checkout-number"
                />
                <Input
                  label={`${t('checkout.complement')} (${t('common.optional')})`}
                  name="complement"
                  autoComplete="address-line2"
                  value={address.complement}
                  onChange={(e) => setAddressField('complement', e.target.value)}
                  error={errors['shippingAddress.complement']}
                  wrapperClassName="sm:col-span-3"
                />
                <Input
                  label={t('checkout.district')}
                  name="district"
                  required
                  value={address.district}
                  onChange={(e) => setAddressField('district', e.target.value)}
                  error={errors['shippingAddress.district']}
                  wrapperClassName="sm:col-span-3"
                  data-testid="checkout-district"
                />
                <Input
                  label={t('checkout.city')}
                  name="city"
                  autoComplete="address-level2"
                  required
                  value={address.city}
                  onChange={(e) => setAddressField('city', e.target.value)}
                  error={errors['shippingAddress.city']}
                  wrapperClassName="sm:col-span-4"
                  data-testid="checkout-city"
                />
                <Select
                  label={t('checkout.state')}
                  name="state"
                  autoComplete="address-level1"
                  required
                  options={STATE_OPTIONS}
                  placeholder="UF"
                  value={address.state}
                  onChange={(e) => setAddressField('state', e.target.value)}
                  error={errors['shippingAddress.state']}
                  wrapperClassName="sm:col-span-2"
                  data-testid="checkout-state"
                />
                <Input
                  label={`${t('checkout.reference')} (${t('common.optional')})`}
                  name="reference"
                  value={address.reference}
                  onChange={(e) => setAddressField('reference', e.target.value)}
                  error={errors['shippingAddress.reference']}
                  wrapperClassName="sm:col-span-3"
                />
                <Input
                  label={`${t('checkout.recipient')} (${t('common.optional')})`}
                  name="recipientName"
                  placeholder={customer.name || undefined}
                  value={address.recipientName}
                  onChange={(e) => setAddressField('recipientName', e.target.value)}
                  error={errors['shippingAddress.recipientName']}
                  wrapperClassName="sm:col-span-3"
                />
                {auth.authenticated && (
                  <div className="sm:col-span-6">
                    <Checkbox
                      name="saveAddress"
                      label={t('checkout.saveAddress')}
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 3. Frete */}
          <section aria-labelledby="step-shipping">
            <SectionHeader step={3} id="step-shipping" title={t('checkout.stepShipping')} />
            <div className="mt-5">
              {!cepValid ? (
                <p className="text-sm text-muted">
                  Informe o CEP de entrega para ver as opções de envio.
                </p>
              ) : shippingQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Spinner size={16} /> Calculando frete com seguro…
                </div>
              ) : shippingError ? (
                <ErrorState
                  message={shippingError.message}
                  onRetry={() => shippingQuery.refetch()}
                />
              ) : shippingOptions.length === 0 ? (
                <p className="text-sm text-muted">
                  Nenhuma opção de envio disponível para este CEP.
                </p>
              ) : (
                <div
                  className="space-y-2"
                  role="radiogroup"
                  aria-label={t('checkout.shippingOptions')}
                >
                  {shippingQuery.data?.freeShipping && (
                    <p className="text-xs text-success">
                      {t('common.freeShipping')} · o seguro do valor total continua incluído.
                    </p>
                  )}
                  {shippingOptions.map((option) => (
                    <ChoiceCard
                      key={option.service}
                      name="shippingService"
                      value={option.service}
                      checked={shippingService === option.service}
                      onChange={(v) => chooseShipping(v as ShippingService)}
                      testId={`shipping-option-${option.service}`}
                      title={option.name}
                      description={`${t('checkout.shippingDeadline', { label: option.deadlineLabel })} · ${t('checkout.shippingInsured')}`}
                      right={
                        <>
                          {formatBRL(option.totalCents)}
                          <span className="block text-right text-[10px] font-normal uppercase tracking-[0.15em] text-muted">
                            {option.freightCents === 0
                              ? t('common.freeShipping')
                              : `frete ${formatBRL(option.freightCents)}`}{' '}
                            + seguro {formatBRL(option.insuranceCents)}
                          </span>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
              {errors.shippingService && (
                <p className="mt-2 text-xs text-danger" role="alert">
                  {errors.shippingService}
                </p>
              )}
            </div>
          </section>

          {/* 4. Pagamento */}
          <section aria-labelledby="step-payment">
            <SectionHeader step={4} id="step-payment" title={t('checkout.stepPayment')} />
            <div
              className="mt-5 space-y-2"
              role="radiogroup"
              aria-label={t('checkout.paymentMethod')}
            >
              {PAYMENT_METHODS.map((method) => (
                <ChoiceCard
                  key={method}
                  name="paymentMethod"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={(v) => {
                    setPaymentMethod(v as PaymentMethod);
                    clearError('payment.method', 'payment.installments');
                  }}
                  testId={`payment-${method}`}
                  title={
                    method === 'pix'
                      ? t('checkout.pix')
                      : method === 'boleto'
                        ? t('checkout.boleto')
                        : t('checkout.card')
                  }
                  description={
                    method === 'pix'
                      ? `${t('checkout.pixText')}${payments.pixDiscountPercent > 0 ? ` ${t('catalog.pixHint', { percent: payments.pixDiscountPercent })}.` : ''}`
                      : method === 'boleto'
                        ? t('checkout.boletoText', { days: payments.boletoDueDays })
                        : t('checkout.cardText', { count: payments.maxInstallments })
                  }
                  right={
                    method === 'pix' && quote && quote.pixDiscountCents > 0
                      ? `− ${formatBRL(quote.pixDiscountCents)}`
                      : undefined
                  }
                />
              ))}
            </div>
            {errors['payment.method'] && (
              <p className="mt-2 text-xs text-danger" role="alert">
                {errors['payment.method']}
              </p>
            )}
            {paymentMethod === 'credit_card' && (
              <div className="mt-4 max-w-sm">
                <Select
                  label={t('checkout.installments')}
                  name="installments"
                  options={installmentOptions.map((o) => ({
                    value: String(o.count),
                    label: o.label,
                  }))}
                  value={String(validInstallments)}
                  onChange={(e) => {
                    setInstallments(Number(e.target.value));
                    clearError('payment.installments', 'installments');
                  }}
                  error={errors['payment.installments'] ?? errors.installments}
                  hint={
                    installmentOptions.length === 0
                      ? 'As parcelas aparecem após o cálculo do frete.'
                      : undefined
                  }
                  disabled={installmentOptions.length === 0}
                />
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <p className="label">{t('cart.coupon')}</p>
                {cart.couponCode ? (
                  <div className="card p-4">
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
                    {errors.couponCode && (
                      <p className="mt-1 text-xs text-danger" role="alert">
                        {errors.couponCode}
                      </p>
                    )}
                    <button
                      type="button"
                      className="link mt-2 text-xs"
                      onClick={() => {
                        cart.setCoupon(null);
                        setCouponInput('');
                        clearError('couponCode');
                      }}
                    >
                      {t('cart.removeCoupon')}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      name="coupon"
                      aria-label={t('cart.couponPlaceholder')}
                      placeholder={t('cart.couponPlaceholder')}
                      autoComplete="off"
                      className="uppercase"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyCoupon(e);
                      }}
                      wrapperClassName="flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={applyCoupon}
                      disabled={!couponInput.trim()}
                    >
                      {t('cart.applyCoupon')}
                    </Button>
                  </div>
                )}
              </div>
              <Textarea
                label={`${t('checkout.notes')} (${t('common.optional')})`}
                name="notes"
                maxLength={500}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  clearError('notes');
                }}
                error={errors.notes}
              />
            </div>

            <div className="mt-8">
              <Checkbox
                name="acceptTerms"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  clearError('acceptTerms');
                }}
                error={errors.acceptTerms}
                data-testid="accept-terms"
                label={
                  <>
                    Li e aceito os{' '}
                    <Link to="/termos" className="link" target="_blank" rel="noreferrer">
                      {t('legal.terms')}
                    </Link>{' '}
                    e a{' '}
                    <Link to="/privacidade" className="link" target="_blank" rel="noreferrer">
                      {t('legal.privacy')}
                    </Link>
                    .
                  </>
                }
              />
            </div>

            <div ref={errorRef} className="mt-6 space-y-4">
              {formError && (
                <Alert tone="danger">
                  <p>
                    <span className="font-semibold">{t('checkout.orderFailed')}</span>{' '}
                    {formError.message}
                  </p>
                  {errors.items && !STOCK_ERROR_CODES.has(formError.code) && (
                    <p className="mt-1">{errors.items}</p>
                  )}
                  {stockProblem && (
                    <Link to="/sacola" className="link mt-2 inline-block text-xs">
                      Revisar a sacola
                    </Link>
                  )}
                </Alert>
              )}
              <Button type="submit" size="lg" full loading={submitting} data-testid="place-order">
                {submitting ? t('checkout.placing') : t('checkout.placeOrder')}
              </Button>
              <p className="flex items-center justify-center gap-2 text-center text-[11px] text-muted">
                <ShieldCheck className="h-4 w-4 text-gold" />
                {t('checkout.shippingInsured')} · pagamento processado pelo Asaas.
              </p>
            </div>
          </section>
        </div>

        {/* Resumo */}
        <aside className="order-first lg:order-none lg:sticky lg:top-36 lg:self-start">
          <div className="card p-6">
            <h2 className="heading text-lg">{t('checkout.summary')}</h2>
            <ul className="mt-5 divide-y divide-line">
              {items.map((item) => (
                <li key={item.variantId} className="flex items-center gap-3 py-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm">
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.name}
                      kind={item.categoryKind}
                      className="absolute inset-0"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold uppercase tracking-wider text-cream">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-muted">
                      {item.variantName} · {item.quantity}×
                    </p>
                  </div>
                  <span className="text-sm text-cream">
                    {formatBRL(item.unitPriceCents * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <Link to="/sacola" className="link mt-2 inline-block text-xs">
              Editar sacola
            </Link>
            <dl className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
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
                  {shippingSelected ? (
                    <>
                      {formatBRL(shippingSelected.totalCents)}
                      <span className="block text-[10px] uppercase tracking-[0.15em] text-muted">
                        {shippingSelected.service} · seguro{' '}
                        {formatBRL(shippingSelected.insuranceCents)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted">a calcular</span>
                  )}
                </dd>
              </div>
              {pixDiscountCents > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t('checkout.pixDiscount')}</dt>
                  <dd className="text-success">− {formatBRL(pixDiscountCents)}</dd>
                </div>
              )}
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
            {paymentMethod === 'credit_card' && chosenInstallment && (
              <p className="mt-2 text-right text-xs text-muted">{chosenInstallment.label}</p>
            )}
            {quoteQuery.error instanceof ApiError && (
              <p className="mt-3 text-xs text-danger" role="alert">
                {quoteQuery.error.message}
              </p>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}

function SectionHeader({ step, id, title }: { step: number; id: string; title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-line pb-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold text-[11px] font-bold text-gold"
        aria-hidden="true"
      >
        {step}
      </span>
      <h2 id={id} className="heading text-xl">
        {title}
      </h2>
    </div>
  );
}

/** Cartão de opção (mesmo visual do RadioCard) com data-testid no rótulo, usado pelos testes e2e. */
function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  right,
  testId,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
  testId: string;
}) {
  return (
    <label
      data-testid={testId}
      className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3.5 transition-colors ${checked ? 'border-gold bg-spruce/60' : 'border-line hover:border-line-strong'}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="accent-gold"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium text-cream">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      {right && <span className="text-sm font-medium text-gold">{right}</span>}
    </label>
  );
}
