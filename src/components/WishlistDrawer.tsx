import React from 'react';
import { Product } from '../types';
import { X, Heart, ShoppingBag, Trash2 } from 'lucide-react';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wishlistIds: string[];
  allProducts: Product[];
  currency: string;
  onRemoveFromWishlist: (id: string) => void;
  onMoveToCart: (product: Product) => void;
  onQuickView: (product: Product) => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  wishlistIds,
  allProducts,
  currency,
  onRemoveFromWishlist,
  onMoveToCart,
  onQuickView,
}) => {
  if (!isOpen) return null;

  const savedProducts = allProducts.filter((p) => wishlistIds.includes(p.id));

  const formatPrice = (amount: number) => {
    switch (currency) {
      case 'EUR':
        return `€${(amount * 0.92).toFixed(2)}`;
      case 'GBP':
        return `£${(amount * 0.79).toFixed(2)}`;
      case 'BRL':
        return `R$ ${(amount * 5.40).toFixed(2)}`;
      case 'USD':
      default:
        return `${amount.toFixed(2)}$`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#091212]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#132524] border-l border-[#1c3836] h-full flex flex-col shadow-2xl text-[#ede7dc]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#1c3836] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#c8a25c] fill-current" />
            <h3 
              className="text-lg font-serif tracking-[0.1em] uppercase text-[#f4efe6]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Saved Masterpieces
            </h3>
            <span className="text-xs text-[#c8a25c] font-sans">({savedProducts.length})</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#ede7dc]/60 hover:text-[#ede7dc] transition-colors rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {savedProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[#182e2c] flex items-center justify-center mb-4 text-[#ede7dc]/40">
                <Heart className="w-8 h-8" />
              </div>
              <h4 className="text-base font-serif uppercase tracking-wider text-[#ede7dc] mb-1">
                No Timepieces Saved
              </h4>
              <p className="text-xs text-[#ede7dc]/60 max-w-xs mb-6">
                Click the heart icon on any timepiece to curate your private acquisition shortlist.
              </p>
            </div>
          ) : (
            savedProducts.map((product) => (
              <div
                key={product.id}
                className="flex gap-4 p-3 bg-[#0e1b1a] border border-[#1a3331] rounded-sm group relative"
              >
                <div 
                  className="w-20 h-20 bg-[#132524] rounded-sm p-1 flex items-center justify-center shrink-0 cursor-pointer"
                  onClick={() => onQuickView(product)}
                >
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-contain drop-shadow"
                  />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h4
                      onClick={() => onQuickView(product)}
                      className="text-xs font-sans font-semibold tracking-wider text-[#f4efe6] uppercase truncate cursor-pointer hover:text-[#c8a25c]"
                    >
                      {product.name}
                    </h4>
                    <p className="text-[10px] text-[#ede7dc]/60 mt-0.5">
                      {product.category}
                    </p>
                    <p className="text-xs font-sans font-medium text-[#c8a25c] mt-1">
                      {formatPrice(product.price)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => onMoveToCart(product)}
                      className="flex-1 py-1.5 px-2.5 bg-[#c8a25c] hover:bg-[#dfbe7d] text-[#0e1b1a] text-[10px] font-sans font-bold tracking-wider uppercase rounded-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>Move to Bag</span>
                    </button>

                    <button
                      onClick={() => onRemoveFromWishlist(product.id)}
                      className="p-1.5 text-[#ede7dc]/40 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
