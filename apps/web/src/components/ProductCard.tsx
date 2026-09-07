import { attributesForKind, formatAttributeValue, type ProductSummary } from '@vellor/shared';
import { Heart, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router';
import { t } from '@/i18n/pt-BR';
import { useWishlist } from '@/store/cart';
import { ProductImage } from './ProductImage';
import { Badge } from './ui/feedback';
import { Price } from './ui/price';

interface ProductCardProps {
  product: ProductSummary;
  onQuickAdd?: (product: ProductSummary) => void;
}

export function ProductCard({ product, onQuickAdd }: ProductCardProps) {
  const wishlist = useWishlist();
  const saved = wishlist.has(product.slug);
  const summaryAttributes = attributesForKind(product.categoryKind)
    .filter((f) => f.summary && product.attributes[f.key] !== undefined && product.attributes[f.key] !== '')
    .slice(0, 3);
  const hasRange = product.minPriceCents !== product.maxPriceCents;

  return (
    <article className="card group relative flex flex-col overflow-hidden transition-colors hover:border-gold/50" data-testid="product-card">
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <button
          type="button"
          aria-label={saved ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={saved}
          onClick={() => wishlist.toggle(product.slug)}
          className={`flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-colors ${saved ? 'bg-gold text-noir' : 'bg-cream/95 text-noir hover:bg-gold'}`}
        >
          <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
        </button>
      </div>
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
        {product.isNew && <Badge tone="gold">{t('common.new')}</Badge>}
        {product.isBestseller && <Badge tone="info">{t('common.bestseller')}</Badge>}
        {!product.inStock && <Badge tone="danger">{t('common.outOfStock')}</Badge>}
      </div>
      <Link to={`/produto/${product.slug}`} className="relative block aspect-square" aria-label={product.name}>
        <ProductImage src={product.primaryImageUrl} alt={product.name} kind={product.categoryKind} className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.03]" />
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 border-t border-line/70 p-4">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
          {product.brand ?? product.categoryName}
          {product.collectionName ? ` · ${product.collectionName}` : ''}
        </span>
        <h3 className="font-sans text-sm font-semibold uppercase tracking-[0.12em] text-cream">
          <Link to={`/produto/${product.slug}`} className="hover:text-gold">
            {product.name}
          </Link>
        </h3>
        {summaryAttributes.length > 0 && (
          <p className="line-clamp-1 text-xs text-muted">{summaryAttributes.map((f) => formatAttributeValue(f, product.attributes[f.key]!)).join(' · ')}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Price cents={product.minPriceCents} compareAtCents={hasRange ? null : product.compareAtPriceCents} from={hasRange} size="sm" />
          {onQuickAdd && product.inStock && (
            <button
              type="button"
              onClick={() => onQuickAdd(product)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong text-ivory/80 transition-colors hover:border-gold hover:bg-gold hover:text-noir"
              aria-label={t('catalog.addToCart')}
              title={t('catalog.addToCart')}
            >
              <ShoppingBag className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, columns = 4, onQuickAdd }: { products: ProductSummary[]; columns?: 2 | 3 | 4; onQuickAdd?: (p: ProductSummary) => void }) {
  const cols = columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
  return (
    <div className={`grid grid-cols-1 gap-5 ${cols}`}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onQuickAdd={onQuickAdd} />
      ))}
    </div>
  );
}
