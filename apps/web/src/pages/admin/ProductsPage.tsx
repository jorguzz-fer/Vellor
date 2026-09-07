import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  type AdminProduct,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  type ProductStatus,
} from '@vellor/shared';
import { Package, Plus, Search, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ProductImage } from '@/components/ProductImage';
import { Button, LinkButton } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState, PageLoader } from '@/components/ui/feedback';
import { Checkbox, Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { Price } from '@/components/ui/price';
import { adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

const PAGE_SIZE = 20;
/** Mesmo limite usado pela API para o filtro "estoque baixo". */
const LOW_STOCK_THRESHOLD = 2;

const STATUS_TONE: Record<ProductStatus, 'muted' | 'success' | 'danger'> = {
  draft: 'muted',
  active: 'success',
  archived: 'danger',
};

const STATUS_OPTIONS = PRODUCT_STATUSES.map((status) => ({
  value: status,
  label: PRODUCT_STATUS_LABELS[status],
}));

function isProductStatus(value: string): value is ProductStatus {
  return (PRODUCT_STATUSES as readonly string[]).includes(value);
}

function totalStock(product: AdminProduct): { stock: number; reserved: number } {
  return product.variants.reduce(
    (acc, variant) => ({
      stock: acc.stock + variant.stockQuantity,
      reserved: acc.reserved + variant.reservedQuantity,
    }),
    { stock: 0, reserved: 0 },
  );
}

export default function ProductsPage() {
  usePageMeta('Produtos');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const statusParam = searchParams.get('status') ?? '';
  const status = isProductStatus(statusParam) ? statusParam : undefined;
  const categoryId = searchParams.get('categoryId') ?? '';
  const lowStock = searchParams.get('lowStock') === 'true';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const hasFilters = Boolean(q || status || categoryId || lowStock);

  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    status,
    categoryId: categoryId || undefined,
    lowStock: lowStock || undefined,
  };

  const products = useQuery({
    queryKey: ['admin', 'products', params],
    queryFn: () => adminApi.products(params),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: adminApi.categories,
    staleTime: 5 * 60_000,
  });

  /** Atualiza os filtros na URL; qualquer mudança de filtro volta para a primeira página. */
  function updateParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in patch)) next.delete('page');
    setSearchParams(next);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    updateParams({ q: search.trim() || undefined });
  }

  const categoryOptions = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: category.isActive ? category.name : `${category.name} (inativa)`,
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Catálogo</p>
          <h1 className="heading text-2xl">Produtos</h1>
        </div>
        <Link to="/admin/produtos/novo" className="btn-primary" data-testid="admin-new-product">
          <Plus className="h-4 w-4" /> Novo produto
        </Link>
      </div>

      <form
        onSubmit={submitSearch}
        className="card mb-6 grid gap-3 p-4 md:grid-cols-[1fr_180px_220px_auto] md:items-end"
        role="search"
        aria-label="Filtrar produtos"
      >
        <div className="relative">
          <Input
            label="Buscar"
            name="q"
            placeholder="Nome, marca ou SKU"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pr-9"
            autoComplete="off"
          />
          <Search
            className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 text-muted"
            aria-hidden="true"
          />
        </div>
        <Select
          label="Status"
          name="status"
          options={STATUS_OPTIONS}
          placeholder="Todos"
          value={status ?? ''}
          onChange={(event) => updateParams({ status: event.target.value || undefined })}
        />
        <Select
          label="Categoria"
          name="categoryId"
          options={categoryOptions}
          placeholder="Todas"
          value={categoryId}
          onChange={(event) => updateParams({ categoryId: event.target.value || undefined })}
          disabled={categories.isLoading}
        />
        <div className="flex flex-wrap items-center gap-3 pb-1 md:pb-2.5">
          <Checkbox
            name="lowStock"
            label="Estoque baixo"
            checked={lowStock}
            onChange={(event) =>
              updateParams({ lowStock: event.target.checked ? 'true' : undefined })
            }
          />
          <Button type="submit" variant="secondary" size="sm">
            Filtrar
          </Button>
          {hasFilters && (
            <button
              type="button"
              className="btn-ghost px-2 py-2 text-[10px]"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              <X className="h-3.5 w-3.5" /> Limpar
            </button>
          )}
        </div>
      </form>

      {products.isLoading ? (
        <PageLoader />
      ) : products.isError ? (
        <ErrorState
          message={products.error instanceof Error ? products.error.message : undefined}
          onRetry={() => products.refetch()}
        />
      ) : !products.data || products.data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title={hasFilters ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
            text={
              hasFilters
                ? 'Ajuste os filtros ou limpe a busca para ver todos os produtos.'
                : 'Cadastre a primeira peça da curadoria para começar a vender.'
            }
            action={
              hasFilters ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSearchParams(new URLSearchParams())}
                >
                  Limpar filtros
                </Button>
              ) : (
                <LinkButton to="/admin/produtos/novo" icon={<Plus className="h-4 w-4" />}>
                  Novo produto
                </LinkButton>
              )
            }
          />
        </div>
      ) : (
        <>
          <div
            className={`card overflow-x-auto transition-opacity ${products.isFetching ? 'opacity-60' : ''}`}
            aria-busy={products.isFetching}
          >
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th className="w-16">
                    <span className="sr-only">Imagem</span>
                  </th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th className="text-right">Estoque</th>
                  <th>Status</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {products.data.items.map((product) => {
                  const { stock, reserved } = totalStock(product);
                  const hasRange = product.minPriceCents !== product.maxPriceCents;
                  const low = stock <= LOW_STOCK_THRESHOLD;
                  return (
                    <tr
                      key={product.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/produtos/${product.id}`)}
                      data-testid="admin-product-row"
                    >
                      <td>
                        <div className="relative h-12 w-12 overflow-hidden rounded-sm border border-line">
                          <ProductImage
                            src={product.primaryImageUrl}
                            alt={product.name}
                            kind={product.categoryKind}
                            className="absolute inset-0"
                          />
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/admin/produtos/${product.id}`}
                          className="font-medium text-cream hover:text-gold"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {product.name}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span>{product.brand ?? 'Sem marca'}</span>
                          {product.isFeatured && <Badge tone="gold">Destaque</Badge>}
                          {product.isNew && <Badge tone="info">Novo</Badge>}
                          {product.isBestseller && <Badge tone="muted">Mais vendido</Badge>}
                        </div>
                      </td>
                      <td>
                        <div>{product.categoryName}</div>
                        {product.collectionName && (
                          <div className="text-xs text-muted">{product.collectionName}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <Price
                          cents={product.minPriceCents}
                          compareAtCents={hasRange ? null : product.compareAtPriceCents}
                          from={hasRange}
                          size="sm"
                        />
                      </td>
                      <td className="text-right">
                        <span className={`font-semibold ${low ? 'text-danger' : 'text-cream'}`}>
                          {stock}
                        </span>
                        {low && (
                          <span className="ml-1.5 align-middle">
                            <Badge tone="danger">Baixo</Badge>
                          </span>
                        )}
                        {reserved > 0 && (
                          <div className="text-[11px] text-muted">{reserved} reservada(s)</div>
                        )}
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[product.status]}>
                          {PRODUCT_STATUS_LABELS[product.status]}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted">
                        {formatDateTime(product.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={products.data.page}
            totalPages={products.data.totalPages}
            total={products.data.total}
            label="produtos"
            onChange={(next) => updateParams({ page: next > 1 ? String(next) : undefined })}
          />
        </>
      )}
    </div>
  );
}
