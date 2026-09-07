import { ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { ProductImage } from '@/components/ProductImage';
import { LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { QuantityInput } from '@/components/ui/form';
import { Drawer } from '@/components/ui/overlay';
import { Price } from '@/components/ui/price';
import { t } from '@/i18n/pt-BR';
import { formatBRL } from '@/lib/format';
import { useCart } from '@/store/cart';

export function CartDrawer() {
  const cart = useCart();
  return (
    <Drawer
      open={cart.isOpen}
      onClose={cart.close}
      title={
        <span className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-gold" />
          {t('cart.title')} <span className="text-xs text-gold">({cart.count})</span>
        </span>
      }
      footer={
        cart.items.length > 0 ? (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">{t('common.subtotal')}</span>
              <span className="font-semibold text-gold">{formatBRL(cart.subtotalCents)}</span>
            </div>
            <p className="text-[11px] text-muted">
              Frete com seguro e descontos calculados na próxima etapa.
            </p>
            <LinkButton to="/checkout" full>
              {t('cart.checkout')}
            </LinkButton>
            <Link
              to="/sacola"
              onClick={cart.close}
              className="block text-center text-[11px] uppercase tracking-[0.2em] text-ivory/70 hover:text-gold"
            >
              Ver sacola completa
            </Link>
          </div>
        ) : undefined
      }
    >
      {cart.items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title={t('cart.empty')}
          text={t('cart.emptyHint')}
          action={
            <button type="button" className="btn-primary" onClick={cart.close}>
              {t('cart.browse')}
            </button>
          }
        />
      ) : (
        <ul className="space-y-4" data-testid="cart-items">
          {cart.items.map((item) => (
            <li
              key={item.variantId}
              className="flex gap-4 rounded-sm border border-line bg-noir p-3"
            >
              <Link
                to={`/produto/${item.slug}`}
                onClick={cart.close}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm"
              >
                <ProductImage
                  src={item.imageUrl}
                  alt={item.name}
                  kind={item.categoryKind}
                  className="absolute inset-0"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-xs font-semibold uppercase tracking-wider text-cream">
                  {item.name}
                </h4>
                <p className="mt-0.5 text-[10px] text-muted">{item.variantName}</p>
                <Price cents={item.unitPriceCents} size="sm" className="mt-1" />
                <div className="mt-2 flex items-center justify-between">
                  <QuantityInput
                    size="sm"
                    value={item.quantity}
                    min={1}
                    max={item.maxQuantity}
                    onChange={(q) => cart.setQuantity(item.variantId, q)}
                  />
                  <button
                    type="button"
                    className="p-1 text-ivory/40 hover:text-danger"
                    aria-label={t('common.remove')}
                    onClick={() => cart.remove(item.variantId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
