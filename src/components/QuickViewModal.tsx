import React, { useState } from 'react';
import { Product } from '../types';
import { 
  X, 
  Heart, 
  ShoppingBag, 
  ShieldCheck, 
  Clock, 
  Compass, 
  Award, 
  Sparkles, 
  Check, 
  CalendarDays 
} from 'lucide-react';

interface QuickViewModalProps {
  product: Product | null;
  currency: string;
  isWishlisted: boolean;
  onToggleWishlist: (id: string) => void;
  onClose: () => void;
  onAddToCart: (product: Product, selectedColorName: string, quantity: number) => void;
  onBookAppointment: (product: Product) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  currency,
  isWishlisted,
  onToggleWishlist,
  onClose,
  onAddToCart,
  onBookAppointment,
}) => {
  if (!product) return null;

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Format currency helper
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

  const handleAdd = () => {
    const colorName = product.colors[selectedColorIndex]?.name || 'Standard';
    onAddToCart(product, colorName, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const currentImage = product.colors[selectedColorIndex]?.image || product.images[activeImageIndex] || product.images[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#091212]/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#132524] border border-[#234542] rounded-sm shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] text-[#ede7dc]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-[#0d1818]/80 text-[#ede7dc] hover:text-[#c8a25c] hover:bg-[#0d1818] flex items-center justify-center border border-[#1f3f3c] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 sm:p-8">
          {/* Left Column: Visual Showcase */}
          <div className="flex flex-col items-center justify-center">
            {/* Main Stage */}
            <div className="relative w-full aspect-square bg-[#0e1b1a] border border-[#1c3836] rounded-sm flex items-center justify-center p-6 mb-4">
              <div className="absolute w-44 h-44 bg-[#c8a25c]/10 rounded-full blur-3xl pointer-events-none" />
              <img
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-contain max-h-[300px] drop-shadow-[0_20px_25px_rgba(0,0,0,0.7)]"
              />
              <span className="absolute bottom-3 left-3 text-[9px] font-sans tracking-widest text-[#ede7dc]/40 uppercase">
                Ref. {product.reference}
              </span>
            </div>

            {/* Gallery Thumbnails */}
            <div className="flex items-center gap-2.5 w-full justify-center">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`w-14 h-14 bg-[#0e1b1a] border rounded-sm p-1 transition-all cursor-pointer ${
                    activeImageIndex === i ? 'border-[#c8a25c] scale-105' : 'border-[#1f3836] opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="thumbnail" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Horology Details & Purchase Controls */}
          <div className="flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between gap-4 mb-2">
                <span className="text-[10px] font-sans tracking-[0.25em] text-[#c8a25c] uppercase">
                  {product.category} · Swiss Horology
                </span>
                <button
                  onClick={() => onToggleWishlist(product.id)}
                  className={`flex items-center gap-1.5 text-xs font-sans tracking-wider transition-colors cursor-pointer ${
                    isWishlisted ? 'text-[#c8a25c]' : 'text-[#ede7dc]/60 hover:text-[#ede7dc]'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
                  <span>{isWishlisted ? 'Saved' : 'Wishlist'}</span>
                </button>
              </div>

              <h2 
                className="text-2xl sm:text-3xl font-serif text-[#f4efe6] tracking-[0.08em] font-normal uppercase mb-2"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                {product.name}
              </h2>

              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-xl font-sans font-medium text-[#c8a25c] tracking-wider">
                  {product.priceRange ? product.priceRange : formatPrice(product.price)}
                </span>
                {product.originalPrice && (
                  <span className="text-sm line-through text-[#ede7dc]/40">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
                <span className="text-[11px] text-[#ede7dc]/60 font-sans">
                  (Includes Insured Worldwide Courier & Duty)
                </span>
              </div>

              <p className="text-xs text-[#ede7dc]/80 leading-relaxed mb-5 font-sans">
                {product.description}
              </p>

              {/* Color Finish Selection */}
              {product.colors && product.colors.length > 0 && (
                <div className="mb-5">
                  <label className="text-[11px] font-sans tracking-widest text-[#ede7dc]/60 uppercase block mb-2">
                    Case & Dial Finish:{' '}
                    <strong className="text-[#f4efe6] font-semibold">
                      {product.colors[selectedColorIndex]?.name}
                    </strong>
                  </label>
                  <div className="flex items-center gap-2.5">
                    {product.colors.map((c, idx) => (
                      <button
                        key={c.name}
                        onClick={() => setSelectedColorIndex(idx)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-xs font-sans transition-all cursor-pointer ${
                          selectedColorIndex === idx
                            ? 'border-[#c8a25c] bg-[#182e2c] text-[#ede7dc]'
                            : 'border-[#234542] text-[#ede7dc]/60 hover:border-[#ede7dc]/40'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.hex }} />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Specifications Sheet */}
              <div className="bg-[#0e1b1a] border border-[#1c3836] p-4 rounded-sm mb-6">
                <h4 className="text-[10px] font-sans tracking-[0.25em] text-[#c8a25c] uppercase mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Manufacture Horological Specifications</span>
                </h4>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px] font-sans">
                  <div>
                    <span className="text-[#ede7dc]/50">Diameter:</span>{' '}
                    <span className="text-[#ede7dc] font-medium">{product.specs.diameter}</span>
                  </div>
                  <div>
                    <span className="text-[#ede7dc]/50">Thickness:</span>{' '}
                    <span className="text-[#ede7dc] font-medium">{product.specs.thickness}</span>
                  </div>
                  <div>
                    <span className="text-[#ede7dc]/50">Calibre:</span>{' '}
                    <span className="text-[#ede7dc] font-medium">{product.specs.calibre}</span>
                  </div>
                  <div>
                    <span className="text-[#ede7dc]/50">Power Reserve:</span>{' '}
                    <span className="text-[#ede7dc] font-medium">{product.specs.powerReserve}</span>
                  </div>
                  <div>
                    <span className="text-[#ede7dc]/50">Case Material:</span>{' '}
                    <span className="text-[#ede7dc] font-medium">{product.specs.caseMaterial}</span>
                  </div>
                  <div>
                    <span className="text-[#ede7dc]/50">Water Res.:</span>{' '}
                    <span className="text-[#ede7dc] font-medium">{product.specs.waterResistance}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-3 border-t border-[#1c3836]">
              <div className="flex items-center gap-3">
                {/* Quantity */}
                <div className="flex items-center border border-[#234542] rounded-sm bg-[#0e1b1a]">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-sm text-[#ede7dc]/70 hover:text-[#c8a25c] transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-3 py-2 text-xs font-semibold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 text-sm text-[#ede7dc]/70 hover:text-[#c8a25c] transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>

                {/* Add to Bag CTA */}
                <button
                  onClick={handleAdd}
                  className="flex-1 py-3 px-6 bg-[#c8a25c] hover:bg-[#dfbe7d] text-[#0e1b1a] text-xs font-sans font-bold tracking-[0.2em] uppercase rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  {added ? (
                    <>
                      <Check className="w-4 h-4 text-[#0e1b1a]" />
                      <span>ACQUIRED TO BAG</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>ACQUIRE TIMEPIECE</span>
                    </>
                  )}
                </button>
              </div>

              {/* Concierge Viewing */}
              <button
                onClick={() => onBookAppointment(product)}
                className="w-full py-2.5 px-4 bg-transparent hover:bg-[#182e2c] border border-[#2d524e] text-[#ede7dc] text-[11px] font-sans tracking-[0.18em] uppercase rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <CalendarDays className="w-3.5 h-3.5 text-[#c8a25c]" />
                <span>Request Private Boutique Viewing</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
