import { useQuery } from '@tanstack/react-query';
import {
  attributesForKind,
  calculateInstallments,
  DEFAULT_STORE_SETTINGS,
  formatAttributeValue,
  percentOf,
  type ProductDetail,
  type ProductSummary,
  type ProductVariant,
} from '@vellor/shared';
import {
  ChevronRight,
  Heart,
  MessageCircle,
  Package,
  SearchX,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Zap,
} from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ProductGrid } from '@/components/ProductCard';
import { ProductImage } from '@/components/ProductImage';
import { Button, LinkButton } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState, PageLoader, useToast } from '@/components/ui/feedback';
import { QuantityInput } from '@/components/ui/form';
import { Price } from '@/components/ui/price';
import { t } from '@/i18n/pt-BR';
import { ApiError, catalogApi } from '@/lib/api';
import { formatBRL, pluralize } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';
import { queryKeys, useSettings } from '@/lib/queries';
import { cartItemFrom, useQuickAdd } from '@/lib/quick-add';
import { useCart, useWishlist } from '@/store/cart';

/** As duas categorias principais têm rotas próprias; as demais usam /categoria/:slug. */
function categoryPath(slug: string): string {
  if (slug === 'relogios') return '/relogios';
  if (slug === 'perfumes') return '/perfumes';
  return `/categoria/${encodeURIComponent(slug)}`;
}

export default function ProductPage() {
  const { slug = '' } = useParams();
  const query = useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => catalogApi.product(slug),
    enabled: slug.length > 0,
  });
  const product = query.data?.product;
  usePageMeta(
    product ? (product.seoTitle ?? product.name) : undefined,
    product ? (product.seoDescription ?? product.shortDescription ?? undefined) : undefined,
  );

  if (query.isPending) return <PageLoader />;

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <ProductNotFound />;
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      </div>
    );
  }

  // A key reinicia o estado (variação, quantidade, imagem) ao navegar para outro produto.
  return (
    <ProductView
      key={query.data.product.id}
      product={query.data.product}
      related={query.data.related}
    />
  );
}

function ProductNotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <EmptyState
        icon={<SearchX className="h-10 w-10" />}
        title="Peça não encontrada"
        text="Este produto pode ter sido vendido ou retirado da curadoria. Explore as categorias para encontrar outras peças."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <LinkButton to="/relogios">{t('nav.watches')}</LinkButton>
            <LinkButton to="/perfumes" variant="secondary">
              {t('nav.perfumes')}
            </LinkButton>
          </div>
        }
      />
    </div>
  );
}

function ProductView({ product, related }: { product: ProductDetail; related: ProductSummary[] }) {
  const cart = useCart();
  const wishlist = useWishlist();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const { quickAdd } = useQuickAdd();

  const variants = useMemo(
    () => [...product.variants].sort((a, b) => a.position - b.position),
    [product.variants],
  );
  const images = useMemo(
    () => [...product.images].sort((a, b) => a.position - b.position),
    [product.images],
  );

  const [variantId, setVariantId] = useState<string | null>(
    () => (variants.find((v) => v.inStock) ?? variants[0])?.id ?? null,
  );
  const [quantity, setQuantity] = useState(1);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

  const variant: ProductVariant | undefined =
    variants.find((v) => v.id === variantId) ?? variants[0];
  const inStock = Boolean(variant?.inStock);
  const maxQuantity = Math.max(1, variant?.availableQuantity ?? 1);
  const qty = Math.min(quantity, maxQuantity);

  const activeImage =
    images.find((i) => i.id === activeImageId) ??
    images.find((i) => i.id === variant?.imageId) ??
    images[0];

  const payments = settings?.payments ?? DEFAULT_STORE_SETTINGS.payments;
  const handlingDays =
    settings?.shipping.handlingDays ?? DEFAULT_STORE_SETTINGS.shipping.handlingDays;
  const installment = variant
    ? calculateInstallments(variant.priceCents, payments)
        .filter((o) => o.count > 1 && !o.hasInterest)
        .at(-1)
    : undefined;
  const pixCents =
    variant && payments.pixDiscountPercent > 0
      ? variant.priceCents - percentOf(variant.priceCents, payments.pixDiscountPercent)
      : null;

  const availability =
    !variant || !variant.inStock
      ? { tone: 'danger' as const, label: t('common.outOfStock') }
      : variant.availableQuantity <= 2
        ? { tone: 'warning' as const, label: t('common.lastUnits') }
        : { tone: 'success' as const, label: t('common.inStock') };

  const specGroups = useMemo(() => {
    const groups = new Map<string, Array<{ label: string; value: string }>>();
    for (const field of attributesForKind(product.categoryKind)) {
      if (field.key.startsWith('_')) continue;
      const raw = product.attributes[field.key];
      if (raw === undefined || raw === null || raw === '') continue;
      const value = formatAttributeValue(field, raw);
      if (!value) continue;
      const rows = groups.get(field.group) ?? [];
      rows.push({ label: field.label, value });
      groups.set(field.group, rows);
    }
    return [...groups.entries()];
  }, [product]);

  const saved = wishlist.has(product.slug);
  const contactPath = `/atendimento?produto=${encodeURIComponent(product.id)}`;

  const selectVariant = (v: ProductVariant) => {
    setVariantId(v.id);
    setQuantity(1);
    if (v.imageId) setActiveImageId(v.imageId);
  };

  const addToCart = (): boolean => {
    if (!variant || !variant.inStock) {
      toast(t('common.outOfStock'), 'warning');
      return false;
    }
    cart.add(cartItemFrom(product, variant), qty);
    return true;
  };

  const handleAdd = () => {
    if (!addToCart()) return;
    cart.open();
    toast(t('catalog.added'), 'success');
  };

  const handleBuyNow = () => {
    if (!addToCart()) return;
    navigate('/checkout');
  };

  const toggleWishlist = () => {
    wishlist.toggle(product.slug);
    toast(saved ? 'Removido dos favoritos.' : 'Salvo nos favoritos.', 'gold');
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast(t('catalog.shareCopied'), 'success');
    } catch {
      toast('Não foi possível copiar o link. Copie o endereço da página.', 'warning');
    }
  };

  const description = product.description?.trim();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
      {/* Breadcrumb */}
      <nav
        aria-label="Navegação estrutural"
        className="mb-6 text-[11px] uppercase tracking-[0.15em] text-muted"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/" className="hover:text-gold">
              {t('nav.home')}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3 w-3" />
          </li>
          <li>
            <Link to={categoryPath(product.categorySlug)} className="hover:text-gold">
              {product.categoryName}
            </Link>
          </li>
          {product.collectionSlug && product.collectionName && (
            <>
              <li aria-hidden="true">
                <ChevronRight className="h-3 w-3" />
              </li>
              <li>
                <Link
                  to={`${categoryPath(product.categorySlug)}?colecao=${encodeURIComponent(product.collectionSlug)}`}
                  className="hover:text-gold"
                >
                  {product.collectionName}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">
            <ChevronRight className="h-3 w-3" />
          </li>
          <li
            aria-current="page"
            className="max-w-[60vw] truncate normal-case tracking-normal text-ivory/80"
          >
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Galeria */}
        <div className="lg:sticky lg:top-36 lg:self-start">
          <div className="relative aspect-square overflow-hidden rounded-sm border border-line bg-noir">
            <ProductImage
              src={activeImage?.url ?? null}
              alt={activeImage?.alt ?? product.name}
              kind={product.categoryKind}
              className="absolute inset-0"
              loading="eager"
            />
            <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
              {product.isNew && <Badge tone="gold">{t('common.new')}</Badge>}
              {product.isBestseller && <Badge tone="info">{t('common.bestseller')}</Badge>}
              {product.isFeatured && <Badge tone="muted">{t('common.featured')}</Badge>}
            </div>
          </div>
          {images.length > 1 && (
            <div
              className="mt-3 grid grid-cols-5 gap-2"
              role="group"
              aria-label="Imagens do produto"
            >
              {images.map((image, index) => {
                const active = image.id === activeImage?.id;
                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setActiveImageId(image.id)}
                    aria-label={image.alt ?? `Imagem ${index + 1} de ${images.length}`}
                    aria-pressed={active}
                    className={`relative aspect-square overflow-hidden rounded-sm border transition-colors ${active ? 'border-gold' : 'border-line hover:border-line-strong'}`}
                  >
                    <ProductImage
                      src={image.url}
                      alt=""
                      kind={product.categoryKind}
                      className="absolute inset-0"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Informações e compra */}
        <div>
          <span className="eyebrow">
            {product.brand ?? product.categoryName}
            {product.collectionName ? ` · ${product.collectionName}` : ''}
          </span>
          <h1
            className="heading mt-2 text-3xl leading-tight md:text-4xl"
            data-testid="product-name"
          >
            {product.name}
          </h1>
          {product.shortDescription && (
            <p className="mt-3 text-sm leading-relaxed text-ivory/80">{product.shortDescription}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {variant && (
              <Price
                cents={variant.priceCents}
                compareAtCents={variant.compareAtPriceCents}
                size="lg"
              />
            )}
            <Badge tone={availability.tone}>{availability.label}</Badge>
          </div>
          {installment && (
            <p className="mt-1.5 text-xs text-muted">
              {t('catalog.installmentsHint', {
                count: installment.count,
                value: formatBRL(installment.installmentCents),
              })}
            </p>
          )}
          {pixCents !== null && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gold">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              {formatBRL(pixCents)} no Pix ·{' '}
              {t('catalog.pixHint', { percent: payments.pixDiscountPercent })}
            </p>
          )}

          {/* Variações */}
          {variants.length > 0 && (
            <fieldset className="mt-7">
              <legend className="label">
                {t('catalog.variant')}
                {variant ? (
                  <span className="ml-1 normal-case tracking-normal text-ivory/80">
                    · {variant.name}
                  </span>
                ) : null}
              </legend>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const selected = v.id === variant?.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      data-testid="variant-option"
                      onClick={() => selectVariant(v)}
                      disabled={!v.inStock}
                      aria-pressed={selected}
                      title={v.inStock ? v.name : `${v.name} — ${t('common.outOfStock')}`}
                      className={`rounded-sm border px-4 py-2 text-xs font-medium tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${
                        selected
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-line-strong text-ivory/85 hover:border-gold hover:text-gold'
                      }`}
                    >
                      {v.name}
                    </button>
                  );
                })}
              </div>
              {variant && (
                <p className="mt-2 text-[11px] text-muted">
                  {t('catalog.sku')} {variant.sku}
                </p>
              )}
            </fieldset>
          )}

          {/* Quantidade e ações */}
          <div className="mt-7 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="label mb-0">{t('common.quantity')}</span>
              <QuantityInput value={qty} min={1} max={maxQuantity} onChange={setQuantity} />
              {variant && inStock && (
                <span className="text-[11px] text-muted">
                  {variant.availableQuantity}{' '}
                  {pluralize(
                    variant.availableQuantity,
                    'unidade disponível',
                    'unidades disponíveis',
                  )}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                data-testid="add-to-cart"
                onClick={handleAdd}
                disabled={!inStock}
                icon={<ShoppingBag className="h-4 w-4" />}
                full
              >
                {t('catalog.addToCart')}
              </Button>
              <Button variant="secondary" onClick={handleBuyNow} disabled={!inStock} full>
                {t('catalog.buyNow')}
              </Button>
            </div>
            {!inStock && (
              <LinkButton
                to={contactPath}
                variant="secondary"
                icon={<MessageCircle className="h-4 w-4" />}
                full
              >
                {t('catalog.consult')}
              </LinkButton>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleWishlist}
                aria-pressed={saved}
                className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                  saved
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-line-strong text-ivory/80 hover:border-gold hover:text-gold'
                }`}
              >
                <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
                {saved ? 'Nos favoritos' : t('nav.wishlist')}
              </button>
              <button
                type="button"
                onClick={share}
                className="inline-flex items-center gap-2 rounded-sm border border-line-strong px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-ivory/80 transition-colors hover:border-gold hover:text-gold"
              >
                <Share2 className="h-4 w-4" />
                {t('catalog.share')}
              </button>
            </div>
          </div>

          {/* Garantias */}
          <div className="mt-8 divide-y divide-line border-y border-line">
            <TrustRow
              icon={<ShieldCheck className="h-4 w-4" />}
              title={t('catalog.authenticity')}
              text={t('catalog.authenticityText')}
            />
            <TrustRow
              icon={<Package className="h-4 w-4" />}
              title={t('catalog.shippingInfo')}
              text={t('catalog.shippingInfoText', { days: handlingDays })}
            />
          </div>
          <Link
            to={contactPath}
            className="link mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]"
          >
            <MessageCircle className="h-4 w-4" />
            {t('catalog.askAbout')}
          </Link>
        </div>
      </div>

      {/* Descrição e ficha técnica */}
      {(description || specGroups.length > 0) && (
        <div className="mt-14 grid gap-10 border-t border-line pt-10 lg:grid-cols-2 lg:gap-14">
          {description && (
            <section aria-labelledby="description-heading">
              <h2 id="description-heading" className="heading text-2xl">
                {t('catalog.description')}
              </h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ivory/85">
                {description}
              </p>
            </section>
          )}
          {specGroups.length > 0 && (
            <section aria-labelledby="specs-heading">
              <h2 id="specs-heading" className="heading text-2xl">
                {t('catalog.specs')}
              </h2>
              <div className="mt-4 space-y-4">
                {specGroups.map(([group, rows]) => (
                  <div key={group} className="card p-5">
                    <h3 className="eyebrow">{group}</h3>
                    <dl className="mt-2 divide-y divide-line/70">
                      {rows.map((row) => (
                        <div
                          key={row.label}
                          className="flex items-baseline justify-between gap-4 py-2 text-sm"
                        >
                          <dt className="shrink-0 text-muted">{row.label}</dt>
                          <dd className="text-right text-cream">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Relacionados */}
      {related.length > 0 && (
        <section className="mt-14 border-t border-line pt-10" aria-labelledby="related-heading">
          <h2 id="related-heading" className="heading mb-8 text-2xl md:text-3xl">
            {t('catalog.related')}
          </h2>
          <ProductGrid products={related} onQuickAdd={quickAdd} />
        </section>
      )}
    </div>
  );
}

function TrustRow({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-4 py-4">
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div>
        <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-cream">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
      </div>
    </div>
  );
}
