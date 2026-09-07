import React, { useState } from 'react';
import { Product } from '../types';
import { Heart, Eye, ShoppingBag, Check } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  currency: string;
  isWishlisted: boolean;
  onToggleWishlist: (id: string) => void;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product, selectedColorName?: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  currency,
  isWishlisted,
  onToggleWishlist,
  onQuickView,
  onAddToCart,
}) => {
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [addedAnimation, setAddedAnimation] = useState(false);

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

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const activeColor = product.colors[selectedColorIndex]?.name || 'Standard';
    onAddToCart(product, activeColor);
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1400);
  };

  const currentImage = product.colors[selectedColorIndex]?.image || product.images[0];

  return (
    <div
      id={`product-card-${product.id}`}
      className="group relative flex flex-col justify-between bg-[#132524] border border-[#1a3533] hover:border-[#c8a25c]/50 transition-all duration-300 p-4 sm:p-5 rounded-sm"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Floating Action Icons (Heart & Eye) matching reference image */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product.id);
          }}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer ${
            isWishlisted
              ? 'bg-[#c8a25c] text-[#0e1b1a]'
              : 'bg-white/95 text-[#142323] hover:bg-[#c8a25c] hover:text-[#0e1b1a]'
          }`}
          title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>

        {/* Quick View Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickView(product);
          }}
          className="w-8 h-8 rounded-full bg-white/95 text-[#142323] hover:bg-[#c8a25c] hover:text-[#0e1b1a] flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer"
          title="Quick View Horology Specs"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Watch Presentation Image Stage */}
      <div 
        className="relative w-full aspect-square flex items-center justify-center overflow-hidden cursor-pointer py-4"
        onClick={() => onQuickView(product)}
      >
        {/* Subtle radial glow under watch dial */}
        <div className="absolute w-36 h-36 bg-[#c8a25c]/5 rounded-full blur-2xl pointer-events-none" />

        <img
          src={currentImage}
          alt={product.name}
          className="w-full h-full object-contain max-h-[220px] transition-transform duration-700 group-hover:scale-105 filter drop-shadow-[0_15px_20px_rgba(0,0,0,0.6)]"
          loading="lazy"
        />

        {/* Quick Add To Bag Overlay Button on Hover */}
        <div className={`absolute bottom-2 inset-x-2 transition-all duration-300 ${
          isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}>
          <button
            onClick={handleAddToCartClick}
            className="w-full py-2 px-3 bg-[#0d1818]/90 hover:bg-[#c8a25c] hover:text-[#0e1b1a] text-[#ede7dc] text-[10px] font-sans font-bold tracking-[0.2em] uppercase rounded-sm border border-[#234542] hover:border-[#c8a25c] transition-all flex items-center justify-center gap-2 backdrop-blur-sm cursor-pointer shadow-lg"
          >
            {addedAnimation ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>ADDED TO BAG</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>ADD TO BAG</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Product Details Section - Exact Layout from reference image */}
      <div className="pt-3 border-t border-[#182e2c]/80 flex flex-col gap-1.5">
        {/* Color Swatch Dots */}
        {product.colors && product.colors.length > 1 ? (
          <div className="flex items-center gap-1.5 mb-1">
            {product.colors.map((color, idx) => (
              <button
                key={color.name}
                onClick={() => setSelectedColorIndex(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-transform cursor-pointer ${
                  selectedColorIndex === idx
                    ? 'ring-1.5 ring-[#c8a25c] ring-offset-1 ring-offset-[#132524] scale-110'
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>
        ) : (
          <div className="h-2.5 mb-1" />
        )}

        {/* Category Label: "Luxury Watches" */}
        <span className="text-[10px] font-sans text-[#ede7dc]/60 tracking-wider">
          {product.category}
        </span>

        {/* Product Title */}
        <h3
          onClick={() => onQuickView(product)}
          className="text-xs sm:text-sm font-sans font-semibold tracking-[0.14em] text-[#f4efe6] uppercase truncate hover:text-[#c8a25c] transition-colors cursor-pointer"
        >
          {product.name}
        </h3>

        {/* Price display matching reference */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs sm:text-sm font-sans font-medium text-[#c8a25c] tracking-wider">
            {product.priceRange ? product.priceRange : formatPrice(product.price)}
          </span>

          {product.originalPrice && (
            <span className="text-[11px] font-sans line-through text-[#ede7dc]/40">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
