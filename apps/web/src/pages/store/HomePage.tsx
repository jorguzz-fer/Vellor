import { useQuery } from '@tanstack/react-query';
import type { ProductQuery, ProductSummary } from '@vellor/shared';
import { ArrowRight, CreditCard, MessageCircle, ShieldCheck, Truck } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { ProductGrid } from '@/components/ProductCard';
import { NewsletterForm } from '@/components/store/NewsletterForm';
import { LinkButton } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';
import { t } from '@/i18n/pt-BR';
import { catalogApi } from '@/lib/api';
import { usePageMeta } from '@/lib/meta';
import { queryKeys } from '@/lib/queries';
import { useQuickAdd } from '@/lib/quick-add';

const FEATURED_PARAMS: Partial<ProductQuery> = { featured: true, pageSize: 8 };
const WATCHES_PARAMS: Partial<ProductQuery> = { category: 'relogios', pageSize: 4 };
const PERFUMES_PARAMS: Partial<ProductQuery> = { category: 'perfumes', pageSize: 4 };
const NEWEST_PARAMS: Partial<ProductQuery> = { sort: 'newest', pageSize: 4 };

const VALUES: Array<{ icon: ComponentType<{ className?: string }>; title: string; text: string }> = [
  { icon: ShieldCheck, title: t('home.valueAuthenticity'), text: t('home.valueAuthenticityText') },
  { icon: Truck, title: t('home.valueShipping'), text: t('home.valueShippingText') },
  { icon: CreditCard, title: t('home.valuePayment'), text: t('home.valuePaymentText') },
  { icon: MessageCircle, title: t('home.valueConcierge'), text: t('home.valueConciergeText') },
];

export default function HomePage() {
  usePageMeta(`${t('brand.tagline')} | Vellor`, t('home.heroText'));
  const { quickAdd } = useQuickAdd();

  return (
    <div className="flex flex-col">
      <Hero />
      <ValueStrip />

      <section className="mx-auto w-full max-w-7xl px-4 py-14 md:px-8 md:py-20" aria-labelledby="featured-heading">
        <SectionHeader id="featured-heading" eyebrow={t('home.heroEyebrow')} title={t('home.featured')} />
        <ProductsBlock params={FEATURED_PARAMS} columns={4} skeleton={8} onQuickAdd={quickAdd} />
      </section>

      <CategoryShowcase
        id="watches-heading"
        eyebrow={t('nav.watches')}
        title={t('home.watchesTitle')}
        text={t('home.watchesText')}
        to="/relogios"
        params={WATCHES_PARAMS}
        onQuickAdd={quickAdd}
      />

      <CategoryShowcase
        id="perfumes-heading"
        eyebrow={t('nav.perfumes')}
        title={t('home.perfumesTitle')}
        text={t('home.perfumesText')}
        to="/perfumes"
        params={PERFUMES_PARAMS}
        onQuickAdd={quickAdd}
        reverse
      />

      <section className="mx-auto w-full max-w-7xl px-4 py-14 md:px-8 md:py-20" aria-labelledby="newest-heading">
        <SectionHeader id="newest-heading" eyebrow={t('common.new')} title={t('home.newArrivals')} to="/relogios?ordem=newest" />
        <ProductsBlock params={NEWEST_PARAMS} columns={4} skeleton={4} onQuickAdd={quickAdd} />
      </section>

      <Newsletter />
    </div>
  );
}

// ---------- Hero ----------

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line bg-noir">
      <div className="absolute inset-0 bg-linear-to-b from-noir via-deep to-deep" aria-hidden="true" />
      <div className="absolute -left-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-spruce blur-3xl" aria-hidden="true" />
      <div
        className="pointer-events-none absolute right-[-6%] top-1/2 hidden h-[34rem] w-[34rem] -translate-y-1/2 rounded-full border border-gold/15 lg:block"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[2%] top-1/2 hidden h-[22rem] w-[22rem] -translate-y-1/2 rounded-full border border-gold/10 lg:block"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-gold/40 to-transparent" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28 lg:py-36">
        <span className="eyebrow">{t('home.heroEyebrow')}</span>
        <h1 className="heading mt-5 max-w-3xl text-4xl leading-[1.05] md:text-6xl">{t('home.heroTitle')}</h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-ivory/80 md:text-base">{t('home.heroText')}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <LinkButton to="/relogios" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
            {t('home.heroCtaWatches')}
          </LinkButton>
          <LinkButton to="/perfumes" variant="secondary" size="lg">
            {t('home.heroCtaPerfumes')}
          </LinkButton>
        </div>
      </div>
    </section>
  );
}

function ValueStrip() {
  return (
    <section className="border-b border-line bg-dark" aria-label="Diferenciais Vellor">
      <ul className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {VALUES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4 px-4 py-6 md:px-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold" aria-hidden="true">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-cream">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Seções de produtos ----------

function SectionHeader({ id, eyebrow, title, text, to }: { id: string; eyebrow?: string; title: string; text?: string; to?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 id={id} className="heading mt-2 text-2xl md:text-3xl">
          {title}
        </h2>
        {text && <p className="mt-2 max-w-lg text-sm text-muted">{text}</p>}
      </div>
      {to && <SeeAllLink to={to} />}
    </div>
  );
}

function SeeAllLink({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold hover:text-gold-light">
      {t('common.seeAll')} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function ProductsBlock({
  params,
  columns,
  skeleton,
  onQuickAdd,
}: {
  params: Partial<ProductQuery>;
  columns: 2 | 3 | 4;
  skeleton: number;
  onQuickAdd: (product: ProductSummary) => void;
}) {
  const query = useQuery({ queryKey: queryKeys.products(params), queryFn: () => catalogApi.products(params) });

  if (query.isPending) return <GridSkeleton count={skeleton} columns={columns} />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  if (query.data.items.length === 0) {
    return <p className="rounded-sm border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Em breve novas peças nesta seleção.</p>;
  }
  return <ProductGrid products={query.data.items} columns={columns} onQuickAdd={onQuickAdd} />;
}

function GridSkeleton({ count, columns }: { count: number; columns: 2 | 3 | 4 }) {
  const cols = columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
  return (
    <div className={`grid grid-cols-1 gap-5 ${cols}`} role="status" aria-label={t('common.loading')} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse overflow-hidden">
          <div className="aspect-square bg-spruce/60" />
          <div className="space-y-2.5 border-t border-line/70 p-4">
            <div className="h-2 w-1/3 rounded-sm bg-spruce" />
            <div className="h-3 w-2/3 rounded-sm bg-spruce" />
            <div className="h-3 w-1/4 rounded-sm bg-spruce" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryShowcase({
  id,
  eyebrow,
  title,
  text,
  to,
  params,
  onQuickAdd,
  reverse,
}: {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  to: string;
  params: Partial<ProductQuery>;
  onQuickAdd: (product: ProductSummary) => void;
  reverse?: boolean;
}) {
  return (
    <section className="border-t border-line bg-dark/40" aria-labelledby={id}>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-12">
        <div className={`relative flex min-h-64 flex-col justify-end overflow-hidden rounded-sm border border-line bg-noir p-8 lg:col-span-4 ${reverse ? 'lg:order-2' : ''}`}>
          <div className="absolute inset-0 bg-linear-to-br from-spruce via-noir to-noir" aria-hidden="true" />
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-10 top-6 h-40 w-40 rounded-full border border-gold/15" aria-hidden="true" />
          <div className="relative">
            <span className="eyebrow">{eyebrow}</span>
            <h2 id={id} className="heading mt-3 text-3xl md:text-4xl">
              {title}
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ivory/75">{text}</p>
            <LinkButton to={to} variant="secondary" className="mt-6" icon={<ArrowRight className="h-4 w-4" />}>
              {t('common.seeAll')}
            </LinkButton>
          </div>
        </div>
        <div className={`lg:col-span-8 ${reverse ? 'lg:order-1' : ''}`}>
          <ProductsBlock params={params} columns={2} skeleton={4} onQuickAdd={onQuickAdd} />
        </div>
      </div>
    </section>
  );
}

// ---------- Newsletter ----------

function Newsletter() {
  return (
    <section className="border-y border-line bg-noir" aria-labelledby="newsletter-heading">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 md:grid-cols-2 md:items-center md:px-8">
        <div>
          <span className="eyebrow">Newsletter</span>
          <h2 id="newsletter-heading" className="heading mt-2 text-2xl md:text-3xl">
            {t('home.newsletterTitle')}
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted">{t('home.newsletterText')}</p>
        </div>
        <div className="w-full max-w-md md:justify-self-end">
          <NewsletterForm source="home" />
        </div>
      </div>
    </section>
  );
}
