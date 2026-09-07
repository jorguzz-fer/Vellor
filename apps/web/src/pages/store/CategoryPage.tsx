import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  PRODUCT_SORT_LABELS,
  PRODUCT_SORTS,
  type ProductQuery,
  type ProductSort,
} from '@vellor/shared';
import { ChevronRight, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ProductGrid } from '@/components/ProductCard';
import { Button, LinkButton } from '@/components/ui/button';
import { EmptyState, ErrorState, PageLoader, Spinner } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n/pt-BR';
import { catalogApi } from '@/lib/api';
import { inputToCents } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';
import { queryKeys, useCategories, useCollections } from '@/lib/queries';
import { useQuickAdd } from '@/lib/quick-add';

const PAGE_SIZE = 12;

/** Nomes conhecidos para evitar "piscar" o título enquanto as categorias carregam. */
const KNOWN_CATEGORY_NAMES: Record<string, string> = {
  relogios: t('nav.watches'),
  perfumes: t('nav.perfumes'),
};

const SORT_OPTIONS = PRODUCT_SORTS.map((sort) => ({
  value: sort,
  label: PRODUCT_SORT_LABELS[sort],
}));

function parseSort(value: string | null): ProductSort {
  return value !== null && (PRODUCT_SORTS as readonly string[]).includes(value)
    ? (value as ProductSort)
    : 'featured';
}

function parsePage(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Valor em reais digitado pelo cliente (param de URL) -> centavos para a API. */
function priceParamToCents(raw: string): number | undefined {
  const cents = inputToCents(raw);
  return cents !== null && cents >= 0 ? cents : undefined;
}

function humanizeSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/^\p{L}/u, (c) => c.toUpperCase());
}

export default function CategoryPage({ slug, mode }: { slug?: string; mode?: 'search' }) {
  const params = useParams();
  const isSearch = mode === 'search';
  const categorySlug = isSearch ? undefined : (slug ?? params.slug);

  const [searchParams, setSearchParams] = useSearchParams();
  const q = isSearch ? (searchParams.get('q') ?? '').trim() : '';
  const collectionSlug = searchParams.get('colecao') ?? '';
  const sort = parseSort(searchParams.get('ordem'));
  const minRaw = searchParams.get('min') ?? '';
  const maxRaw = searchParams.get('max') ?? '';
  const page = parsePage(searchParams.get('pagina'));

  const categories = useCategories();
  const collections = useCollections(categorySlug);
  const { quickAdd } = useQuickAdd();

  const category = categories.data?.find((c) => c.slug === categorySlug);
  const categoryMissing = !isSearch && categories.isSuccess && !category;

  let minPriceCents = priceParamToCents(minRaw);
  let maxPriceCents = priceParamToCents(maxRaw);
  if (minPriceCents !== undefined && maxPriceCents !== undefined && minPriceCents > maxPriceCents) {
    [minPriceCents, maxPriceCents] = [maxPriceCents, minPriceCents];
  }

  const queryParams: Partial<ProductQuery> = {
    category: categorySlug,
    collection: collectionSlug || undefined,
    q: q || undefined,
    sort,
    minPriceCents,
    maxPriceCents,
    page,
    pageSize: PAGE_SIZE,
  };
  const enabled = isSearch ? q.length > 0 : Boolean(categorySlug) && !categoryMissing;

  const products = useQuery({
    queryKey: queryKeys.products(queryParams),
    queryFn: () => catalogApi.products(queryParams),
    placeholderData: keepPreviousData,
    enabled,
  });

  const title = isSearch
    ? t('catalog.searchTitle', { q })
    : (category?.name ??
      (categorySlug
        ? (KNOWN_CATEGORY_NAMES[categorySlug] ?? humanizeSlug(categorySlug))
        : t('catalog.allProducts')));
  usePageMeta(title, category?.description ?? undefined);

  // Campos de preço e busca são locais até o cliente aplicar (evita reescrever a URL a cada tecla).
  const [minInput, setMinInput] = useState(minRaw);
  const [maxInput, setMaxInput] = useState(maxRaw);
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => {
    setMinInput(minRaw);
    setMaxInput(maxRaw);
  }, [minRaw, maxRaw]);
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const updateParams = (
    patch: Record<string, string | null | undefined>,
    options: { keepPage?: boolean } = {},
  ) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (!options.keepPage) next.delete('pagina');
    setSearchParams(next);
  };

  const hasFilters = Boolean(collectionSlug || minRaw || maxRaw || sort !== 'featured');
  const clearFilters = () => updateParams({ colecao: null, min: null, max: null, ordem: null });

  const applyPrice = (event: FormEvent) => {
    event.preventDefault();
    updateParams({ min: minInput.trim() || null, max: maxInput.trim() || null });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    updateParams({ q: searchInput.trim() || null });
  };

  const goToPage = (next: number) => {
    updateParams({ pagina: next > 1 ? String(next) : null }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const total = products.data?.total;
  const countLabel =
    total === undefined
      ? null
      : total === 1
        ? t('catalog.productCount', { count: 1 })
        : t('catalog.productsCount', { count: total });

  if (categoryMissing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <EmptyState
          icon={<SearchX className="h-10 w-10" />}
          title="Categoria não encontrada"
          text="A categoria que você procura não existe ou foi desativada. Explore a curadoria pelas categorias principais."
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      {/* Cabeçalho */}
      <header className="relative mb-8 overflow-hidden rounded-sm border border-line bg-dark">
        {category?.heroImageUrl && (
          <img
            src={category.heroImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
            loading="eager"
          />
        )}
        <div
          className="absolute inset-0 bg-linear-to-r from-noir via-noir/80 to-transparent"
          aria-hidden="true"
        />
        <div className="relative px-6 py-10 md:px-10 md:py-14">
          <nav
            aria-label="Navegação estrutural"
            className="mb-4 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted"
          >
            <Link to="/" className="hover:text-gold">
              {t('nav.home')}
            </Link>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="text-ivory/80">{isSearch ? t('nav.search') : title}</span>
          </nav>
          <h1 className="heading text-3xl md:text-4xl" data-testid="category-title">
            {title}
          </h1>
          {!isSearch && category?.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ivory/75">
              {category.description}
            </p>
          )}
          {isSearch && (
            <form
              onSubmit={submitSearch}
              role="search"
              className="mt-5 flex max-w-xl flex-col gap-2 sm:flex-row"
            >
              <Input
                name="q"
                aria-label={t('nav.search')}
                placeholder="Buscar relógios, perfumes, marcas…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                wrapperClassName="flex-1"
              />
              <Button type="submit" variant="secondary">
                {t('common.search')}
              </Button>
            </form>
          )}
        </div>
      </header>

      {/* Coleções */}
      {!isSearch && collections.data && collections.data.length > 0 && (
        <div className="mb-6">
          <span className="label">{t('catalog.collections')}</span>
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:flex-wrap md:px-0"
            role="group"
            aria-label={t('catalog.collections')}
          >
            <Chip active={!collectionSlug} onClick={() => updateParams({ colecao: null })}>
              {t('common.all')}
            </Chip>
            {collections.data.map((c) => (
              <Chip
                key={c.id}
                active={collectionSlug === c.slug}
                onClick={() => updateParams({ colecao: c.slug })}
              >
                {c.name}
                {c.productCount !== undefined && (
                  <span
                    className={`ml-1.5 ${collectionSlug === c.slug ? 'text-noir/70' : 'text-muted'}`}
                  >
                    {c.productCount}
                  </span>
                )}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Filtros e ordenação */}
      <div className="mb-6 flex flex-col gap-4 border-y border-line py-4 lg:flex-row lg:items-end lg:justify-between">
        <form onSubmit={applyPrice} className="flex flex-wrap items-end gap-2">
          <fieldset className="flex flex-wrap items-end gap-2">
            <legend className="label">{t('catalog.priceRange')}</legend>
            <Input
              name="min"
              aria-label="Preço mínimo em reais"
              placeholder="Mín. R$"
              inputMode="decimal"
              autoComplete="off"
              value={minInput}
              onChange={(e) => setMinInput(e.target.value)}
              wrapperClassName="w-28"
            />
            <Input
              name="max"
              aria-label="Preço máximo em reais"
              placeholder="Máx. R$"
              inputMode="decimal"
              autoComplete="off"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              wrapperClassName="w-28"
            />
            <Button
              type="submit"
              variant="secondary"
              icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            >
              {t('common.filter')}
            </Button>
          </fieldset>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={clearFilters}
              icon={<X className="h-3.5 w-3.5" />}
            >
              {t('common.clearFilters')}
            </Button>
          )}
        </form>

        <div className="flex items-end justify-between gap-4 lg:justify-end">
          <p className="pb-2.5 text-xs text-muted" aria-live="polite">
            {products.isFetching && <Spinner size={12} className="mr-2 align-middle" />}
            {countLabel}
          </p>
          <Select
            name="ordem"
            label={t('common.sortBy')}
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) =>
              updateParams({ ordem: e.target.value === 'featured' ? null : e.target.value })
            }
            wrapperClassName="w-44 sm:w-52"
          />
        </div>
      </div>

      {/* Grade */}
      {!enabled ? (
        <EmptyState
          icon={<SearchX className="h-10 w-10" />}
          title="O que você procura?"
          text="Digite o nome de uma peça, uma marca ou uma coleção para buscar na curadoria."
        />
      ) : products.isPending ? (
        <PageLoader />
      ) : products.isError ? (
        <ErrorState message={products.error.message} onRetry={() => products.refetch()} />
      ) : products.data.items.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-10 w-10" />}
          title={isSearch && !hasFilters ? t('common.noResults') : t('catalog.empty')}
          text={
            isSearch
              ? 'Tente outro termo ou explore as categorias principais.'
              : 'Ajuste a faixa de preço ou a coleção para ver mais peças.'
          }
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                onClick={clearFilters}
                icon={<X className="h-3.5 w-3.5" />}
              >
                {t('common.clearFilters')}
              </Button>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <LinkButton to="/relogios">{t('nav.watches')}</LinkButton>
                <LinkButton to="/perfumes" variant="secondary">
                  {t('nav.perfumes')}
                </LinkButton>
              </div>
            )
          }
        />
      ) : (
        <>
          <div className={`transition-opacity ${products.isPlaceholderData ? 'opacity-60' : ''}`}>
            <ProductGrid products={products.data.items} onQuickAdd={quickAdd} />
          </div>
          <Pagination
            page={products.data.page}
            totalPages={products.data.totalPages}
            onChange={goToPage}
          />
        </>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
        active
          ? 'border-gold bg-gold text-noir'
          : 'border-line-strong text-ivory/80 hover:border-gold hover:text-gold'
      }`}
    >
      {children}
    </button>
  );
}
