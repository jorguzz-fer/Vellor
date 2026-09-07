import { useQueries } from '@tanstack/react-query';
import type { ProductSummary } from '@vellor/shared';
import { Heart, X } from 'lucide-react';
import { ProductGrid } from '@/components/ProductCard';
import { LinkButton } from '@/components/ui/button';
import { Alert, EmptyState, ErrorState, PageLoader } from '@/components/ui/feedback';
import { t } from '@/i18n/pt-BR';
import { ApiError, catalogApi } from '@/lib/api';
import { pluralize } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';
import { queryKeys } from '@/lib/queries';
import { useQuickAdd } from '@/lib/quick-add';
import { useWishlist } from '@/store/cart';

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export default function WishlistPage() {
  usePageMeta(t('nav.wishlist'));
  const wishlist = useWishlist();
  const { quickAdd } = useQuickAdd();

  const results = useQueries({
    queries: wishlist.slugs.map((slug) => ({
      queryKey: queryKeys.product(slug),
      queryFn: () => catalogApi.product(slug),
      staleTime: 60_000,
    })),
  });

  // ProductDetail estende ProductSummary, então o card recebe o objeto inteiro.
  const products: ProductSummary[] = results.flatMap((r) => (r.data ? [r.data.product] : []));
  const missing = wishlist.slugs.filter((_, i) => isNotFound(results[i]?.error));
  const failed = results.filter((r) => r.isError && !isNotFound(r.error));
  const loading = results.some((r) => r.isPending);

  if (wishlist.slugs.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <PageHeader count={0} />
        <EmptyState
          icon={<Heart className="h-10 w-10" />}
          title="Sua lista de favoritos está vazia."
          text="Toque no coração de uma peça para guardá-la aqui e voltar quando quiser."
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
      <PageHeader count={wishlist.slugs.length} />

      {missing.length > 0 && (
        <Alert tone="warning" className="mb-6">
          <p>
            {missing.length === 1 ? 'Uma peça salva não está mais disponível na curadoria.' : `${missing.length} peças salvas não estão mais disponíveis na curadoria.`}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((slug) => (
              <li key={slug}>
                <button
                  type="button"
                  onClick={() => wishlist.toggle(slug)}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-line-strong px-2.5 py-1 text-[11px] uppercase tracking-[0.15em] text-ivory/80 hover:border-gold hover:text-gold"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  {t('common.remove')} <span className="normal-case tracking-normal text-muted">({slug})</span>
                </button>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {failed.length > 0 && (
        <div className="mb-6">
          <ErrorState message={failed[0]?.error?.message ?? t('common.error')} onRetry={() => failed.forEach((r) => r.refetch())} />
        </div>
      )}

      {loading && products.length === 0 ? (
        <PageLoader />
      ) : products.length > 0 ? (
        <ProductGrid products={products} onQuickAdd={quickAdd} />
      ) : failed.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-10 w-10" />}
          title="Nenhuma peça disponível"
          text="As peças salvas não estão mais na curadoria. Remova-as acima ou explore as categorias."
        />
      ) : null}
    </div>
  );
}

function PageHeader({ count }: { count: number }) {
  return (
    <header className="mb-8 border-b border-line pb-6">
      <span className="eyebrow">{t('nav.account')}</span>
      <h1 className="heading mt-2 text-3xl md:text-4xl">{t('nav.wishlist')}</h1>
      <p className="mt-2 text-sm text-muted">
        {count === 0 ? 'Nenhuma peça salva.' : `${count} ${pluralize(count, 'peça salva', 'peças salvas')} neste navegador.`}
      </p>
    </header>
  );
}
