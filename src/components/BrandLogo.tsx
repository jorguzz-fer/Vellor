import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'gold' | 'ivory' | 'noir';
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  variant = 'gold',
  showSubtitle = true,
  className = '',
}) => {
  // Color styling based on provided image palettes
  const colorClasses = {
    gold: {
      v: 'text-[#c8a25c]',
      line: 'bg-[#c8a25c]/50',
      brand: 'text-[#c8a25c]',
      subtitle: 'text-[#c8a25c]/85',
    },
    ivory: {
      v: 'text-[#ede7dc]',
      line: 'bg-[#ede7dc]/50',
      brand: 'text-[#ede7dc]',
      subtitle: 'text-[#ede7dc]/80',
    },
    noir: {
      v: 'text-[#142323]',
      line: 'bg-[#142323]/50',
      brand: 'text-[#142323]',
      subtitle: 'text-[#142323]/80',
    },
  }[variant];

  const sizeClasses = {
    sm: {
      v: 'text-2xl',
      brand: 'text-base tracking-[0.25em]',
      subtitle: 'text-[8px] tracking-[0.3em]',
      line: 'h-6 w-[1px]',
      gap: 'gap-2.5',
    },
    md: {
      v: 'text-3xl md:text-4xl',
      brand: 'text-lg md:text-xl tracking-[0.28em]',
      subtitle: 'text-[9px] md:text-[10px] tracking-[0.35em]',
      line: 'h-8 md:h-9 w-[1.5px]',
      gap: 'gap-3 md:gap-3.5',
    },
    lg: {
      v: 'text-5xl md:text-6xl',
      brand: 'text-2xl md:text-3xl tracking-[0.32em]',
      subtitle: 'text-[11px] md:text-xs tracking-[0.4em]',
      line: 'h-12 md:h-14 w-[1.5px]',
      gap: 'gap-4 md:gap-5',
    },
  }[size];

  return (
    <div className={`inline-flex items-center select-none ${sizeClasses.gap} ${className}`}>
      {/* V Emblem */}
      <span
        className={`font-serif italic font-normal leading-none transition-colors duration-300 ${sizeClasses.v} ${colorClasses.v}`}
        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
      >
        V
      </span>

      {/* Elegant Vertical Divider Line as in user's image */}
      <span className={`block transition-colors duration-300 ${sizeClasses.line} ${colorClasses.line}`} />

      {/* Brand Text */}
      <div className="flex flex-col justify-center">
        <span
          className={`font-serif font-medium uppercase leading-none transition-colors duration-300 ${sizeClasses.brand} ${colorClasses.brand}`}
          style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
        >
          VELLOR
        </span>
        {showSubtitle && (
          <span
            className={`font-sans font-semibold uppercase mt-1 transition-colors duration-300 ${sizeClasses.subtitle} ${colorClasses.subtitle}`}
          >
            WEALTH WATCHES
          </span>
        )}
      </div>
    </div>
  );
};
