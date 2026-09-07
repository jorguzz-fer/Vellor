interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

const SIZES = {
  sm: { v: 'text-2xl', brand: 'text-base tracking-[0.3em]', tagline: 'text-[8px] tracking-[0.3em]', line: 'h-6', gap: 'gap-2.5' },
  md: { v: 'text-3xl md:text-4xl', brand: 'text-lg md:text-xl tracking-[0.32em]', tagline: 'text-[9px] tracking-[0.35em]', line: 'h-8 md:h-9', gap: 'gap-3' },
  lg: { v: 'text-5xl md:text-6xl', brand: 'text-2xl md:text-3xl tracking-[0.35em]', tagline: 'text-[11px] tracking-[0.4em]', line: 'h-12 md:h-14', gap: 'gap-4' },
};

export function BrandLogo({ size = 'md', showTagline = true, className = '' }: BrandLogoProps) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex select-none items-center ${s.gap} ${className}`} aria-label="Vellor">
      <span className={`font-display italic leading-none text-gold ${s.v}`}>V</span>
      <span className={`block w-px bg-gold/50 ${s.line}`} />
      <span className="flex flex-col justify-center">
        <span className={`font-display font-medium uppercase leading-none text-gold ${s.brand}`}>Vellor</span>
        {showTagline && <span className={`mt-1 font-sans font-semibold uppercase text-gold/80 ${s.tagline}`}>Relógios · Perfumes</span>}
      </span>
    </span>
  );
}
