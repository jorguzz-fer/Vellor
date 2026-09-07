import type { ProductDetail, ProductSummary, ProductVariant } from '@vellor/shared';
import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui/feedback';
import { t } from '@/i18n/pt-BR';
import { useCart } from '@/store/cart';
import { ApiError, catalogApi } from './api';

/** Monta o item da sacola a partir de um produto detalhado e uma variação escolhida. */
export function cartItemFrom(product: ProductDetail, variant: ProductVariant) {
  const image = product.images.find((i) => i.id === variant.imageId) ?? product.images[0];
  return {
    variantId: variant.id,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    variantName: variant.name,
    unitPriceCents: variant.priceCents,
    imageUrl: image?.url ?? null,
    categoryKind: product.categoryKind,
    maxQuantity: Math.max(1, variant.availableQuantity),
  };
}

/**
 * "Adicionar rápido" a partir de um card: busca o detalhe do produto, escolhe a
 * primeira variação em estoque, adiciona à sacola e abre o drawer.
 */
export function useQuickAdd() {
  const cart = useCart();
  const { toast } = useToast();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const quickAdd = useCallback(
    async (product: ProductSummary) => {
      setLoadingSlug(product.slug);
      try {
        const { product: detail } = await catalogApi.product(product.slug);
        const variant = detail.variants.find((v) => v.inStock) ?? detail.variants[0];
        if (!variant || !variant.inStock) {
          toast(t('common.outOfStock'), 'warning');
          return;
        }
        cart.add(cartItemFrom(detail, variant), 1);
        cart.open();
        toast(t('catalog.added'), 'success');
      } catch (error) {
        toast(error instanceof ApiError ? error.message : t('common.error'), 'danger');
      } finally {
        setLoadingSlug(null);
      }
    },
    [cart, toast],
  );

  return { quickAdd, loadingSlug };
}
