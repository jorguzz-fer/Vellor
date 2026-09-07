import React, { useState } from 'react';
import { CartItem } from '../types';
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Truck, Check } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  currency: string;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  currency,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const [promoCode, setPromoCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoApplied, setPromoApplied] = useState('');

  if (!isOpen) return null;

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

  const rawSubtotal = items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const discountAmount = (rawSubtotal * discountPercent) / 100;
  const finalTotal = Math.max(0, rawSubtotal - discountAmount);

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (code === 'VELLOR10') {
      setDiscountPercent(10);
      setPromoApplied('10% VIP Privilege applied');
      setPromoError('');
    } else if (code === 'VELLOR-30-PRIVILEGE' || code === 'VELLOR30') {
      setDiscountPercent(30);
      setPromoApplied('30% Welcome Privilege applied');
      setPromoError('');
    } else {
      setPromoError('Invalid privilege code');
      setPromoApplied('');
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
            <ShoppingBag className="w-5 h-5 text-[#c8a25c]" />
            <h3 
              className="text-lg font-serif tracking-[0.1em] uppercase text-[#f4efe6]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              Your Shopping Bag
            </h3>
            <span className="text-xs text-[#c8a25c] font-sans">({items.length})</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#ede7dc]/60 hover:text-[#ede7dc] transition-colors rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compliments Banner */}
        <div className="bg-[#0e1b1a] px-5 py-2.5 border-b border-[#1c3836] flex items-center gap-2 text-[10px] tracking-wider text-[#ede7dc]/80">
          <Truck className="w-3.5 h-3.5 text-[#c8a25c]" />
          <span>Complimentary Insured Courier & Presentation Box Included</span>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[#182e2c] flex items-center justify-center mb-4 text-[#ede7dc]/40">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h4 className="text-base font-serif uppercase tracking-wider text-[#ede7dc] mb-1">
                Your Bag is Empty
              </h4>
              <p className="text-xs text-[#ede7dc]/60 max-w-xs mb-6">
                Explore the Vellor catalog and select an exceptional timepiece for your collection.
              </p>
              <button
                onClick={onClose}
                className="py-2.5 px-6 bg-[#c8a25c] text-[#0e1b1a] text-xs font-sans font-bold tracking-widest uppercase rounded-sm hover:bg-[#dfbe7d] transition-colors cursor-pointer"
              >
                Browse Collection
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 p-3 bg-[#0e1b1a] border border-[#1a3331] rounded-sm relative group"
              >
                {/* Image */}
                <div className="w-20 h-20 bg-[#132524] rounded-sm p-1 flex items-center justify-center shrink-0">
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    className="w-full h-full object-contain drop-shadow"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-sans font-semibold tracking-wider text-[#f4efe6] uppercase truncate">
                    {item.product.name}
                  </h4>
                  <p className="text-[10px] text-[#ede7dc]/60 mt-0.5">
                    Finish: {item.selectedColor}
                  </p>
                  <p className="text-xs font-sans font-medium text-[#c8a25c] mt-1">
                    {formatPrice(item.product.price)}
                  </p>

                  {/* Quantity controls */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-[#244542] rounded-sm bg-[#132524]">
                      <button
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="px-2 py-0.5 text-xs text-[#ede7dc]/60 hover:text-[#c8a25c] cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-2 py-0.5 text-[11px] font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="px-2 py-0.5 text-xs text-[#ede7dc]/60 hover:text-[#c8a25c] cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-[#ede7dc]/40 hover:text-rose-400 p-1 transition-colors cursor-pointer"
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

        {/* Footer / Summary */}
        {items.length > 0 && (
          <div className="p-5 border-t border-[#1c3836] bg-[#0e1b1a]/80 space-y-4">
            {/* Promo Code Form */}
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Privilege Code (e.g. VELLOR10)"
                className="flex-1 bg-[#132524] border border-[#234542] rounded-sm px-3 py-1.5 text-xs text-[#ede7dc] placeholder-[#ede7dc]/40 focus:outline-none focus:border-[#c8a25c] uppercase tracking-wider font-sans"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#1f3d3a] hover:bg-[#c8a25c] hover:text-[#0e1b1a] text-xs font-sans tracking-wider uppercase rounded-sm transition-colors cursor-pointer"
              >
                Apply
              </button>
            </form>

            {promoApplied && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-sans">
                <Check className="w-3 h-3" />
                <span>{promoApplied}</span>
              </p>
            )}

            {promoError && (
              <p className="text-[11px] text-rose-400 font-sans">
                {promoError}
              </p>
            )}

            {/* Calculations */}
            <div className="space-y-1.5 text-xs font-sans">
              <div className="flex justify-between text-[#ede7dc]/70">
                <span>Subtotal</span>
                <span>{formatPrice(rawSubtotal)}</span>
              </div>

              {discountPercent > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Privilege Privilege (-{discountPercent}%)</span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-[#ede7dc]/70">
                <span>Worldwide Courier</span>
                <span className="text-emerald-400">COMPLIMENTARY</span>
              </div>

              <div className="pt-2 border-t border-[#1c3836] flex justify-between text-sm font-semibold text-[#f4efe6]">
                <span>Total</span>
                <span className="text-[#c8a25c] text-base">{formatPrice(finalTotal)}</span>
              </div>
            </div>

            {/* Checkout Action */}
            <button
              onClick={onCheckout}
              className="w-full py-3.5 bg-[#c8a25c] hover:bg-[#dfbe7d] text-[#0e1b1a] text-xs font-sans font-bold tracking-[0.2em] uppercase rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <span>PROCEED TO CONCIERGE CHECKOUT</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] text-[#ede7dc]/50 tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-[#c8a25c]" />
              <span>256-Bit Encrypted Secure Horology Escrow</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
