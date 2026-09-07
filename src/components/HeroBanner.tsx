import React from 'react';
import { Compass, ShoppingBag, Sparkles, ArrowDown } from 'lucide-react';

interface HeroBannerProps {
  title?: string;
  subtitle?: string;
  categoryName?: string;
  onExploreClick: () => void;
  onOpenQuickCart: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  title = 'PRODUCT LIST BOXED',
  categoryName = 'Horology Collection',
  onExploreClick,
  onOpenQuickCart,
}) => {
  return (
    <div id="top" className="relative w-full h-[380px] sm:h-[440px] md:h-[500px] overflow-hidden bg-[#0d1818] mt-[85px] md:mt-[95px]">
      {/* High-Fashion Editorial Background matching the image reference */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
        style={{
          // Luxury editorial shoot: high fashion tailoring, urban architectural stairs, haute horlogerie aesthetic
          backgroundImage: `url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=2000&q=85')`,
        }}
      >
        {/* Deep Forest Emerald / Charcoal Gradients from Vellor Brand Palette */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1818]/90 via-[#132524]/60 to-[#0d1818]/85" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#132524]/70 via-transparent to-[#101f20]" />
      </div>

      {/* Floating Side Badges on Right Edge - Exactly matching reference image */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col gap-2.5 shadow-2xl">
        <button
          onClick={onExploreClick}
          className="group flex items-center gap-2 bg-[#e11d48] text-white px-3.5 py-2.5 rounded-l-md text-[10px] font-sans font-bold tracking-widest uppercase hover:bg-[#be123c] transition-all transform hover:-translate-x-1 cursor-pointer shadow-lg"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>RELATED</span>
        </button>

        <button
          onClick={onOpenQuickCart}
          className="group flex items-center gap-2 bg-[#ede7dc] text-[#142323] px-3.5 py-2.5 rounded-l-md text-[10px] font-sans font-bold tracking-widest uppercase hover:bg-white transition-all transform hover:-translate-x-1 cursor-pointer shadow-lg"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-[#e11d48]" />
          <span>BUY NOW</span>
        </button>
      </div>

      {/* Centered Content */}
      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 flex flex-col justify-center items-center text-center">
        {/* Subtle decorative gold badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#c8a25c]/30 bg-[#132524]/60 backdrop-blur-sm text-[#c8a25c] text-[10px] font-sans tracking-[0.3em] uppercase mb-4">
          <Sparkles className="w-3 h-3" />
          <span>Atelier Vellor · Swiss Heritage</span>
        </div>

        {/* Main Title from Reference Image: "PRODUCT LIST BOXED" */}
        <h1 
          className="text-3xl sm:text-4xl md:text-6xl font-serif text-[#f4efe6] tracking-[0.12em] font-normal uppercase leading-tight drop-shadow-md"
          style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
        >
          {title}
        </h1>

        {/* Breadcrumb matching the exact format: Home / Product List Boxed */}
        <div className="flex items-center gap-2.5 text-xs sm:text-sm font-sans tracking-widest text-[#ede7dc]/80 mt-3 sm:mt-4">
          <a href="#top" className="hover:text-[#c8a25c] transition-colors">Home</a>
          <span className="text-[#c8a25c]/60">/</span>
          <span className="text-[#c8a25c] font-medium">{categoryName}</span>
        </div>

        {/* Scroll down indicator */}
        <button
          onClick={onExploreClick}
          className="mt-8 sm:mt-10 inline-flex items-center gap-2 text-[10px] tracking-[0.25em] text-[#ede7dc]/60 hover:text-[#c8a25c] transition-colors uppercase group cursor-pointer"
        >
          <span>DISCOVER MASTERPIECES</span>
          <ArrowDown className="w-3 h-3 group-hover:translate-y-1 transition-transform text-[#c8a25c]" />
        </button>
      </div>
    </div>
  );
};
