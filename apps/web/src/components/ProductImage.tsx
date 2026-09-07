import type { CategoryKind } from '@vellor/shared';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  kind: CategoryKind;
  className?: string;
  imgClassName?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * Imagem do produto com placeholder elegante por tipo (relógio ou perfume)
 * enquanto o catálogo real não tem fotos.
 */
export function ProductImage({ src, alt, kind, className = '', imgClassName = '', loading = 'lazy' }: ProductImageProps) {
  if (src) {
    return (
      <div className={`overflow-hidden bg-noir ${className}`}>
        <img src={src} alt={alt} loading={loading} className={`h-full w-full object-cover ${imgClassName}`} />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center bg-noir ${className}`} role="img" aria-label={alt}>
      <div className="absolute h-40 w-40 rounded-full bg-gold/5 blur-3xl" />
      {kind === 'perfume' ? <PerfumeGlyph /> : <WatchGlyph />}
    </div>
  );
}

function WatchGlyph() {
  return (
    <svg viewBox="0 0 200 200" className="relative h-[62%] w-[62%] text-gold/70" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="78" y="14" width="44" height="30" rx="4" strokeOpacity="0.6" />
      <rect x="78" y="156" width="44" height="30" rx="4" strokeOpacity="0.6" />
      <circle cx="100" cy="100" r="62" strokeWidth="3" />
      <circle cx="100" cy="100" r="52" strokeOpacity="0.5" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r1 = i % 3 === 0 ? 40 : 45;
        return <line key={i} x1={100 + Math.sin(a) * r1} y1={100 - Math.cos(a) * r1} x2={100 + Math.sin(a) * 49} y2={100 - Math.cos(a) * 49} strokeWidth={i % 3 === 0 ? 2.5 : 1.5} />;
      })}
      <line x1="100" y1="100" x2="100" y2="66" strokeWidth="3" strokeLinecap="round" />
      <line x1="100" y1="100" x2="124" y2="112" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="100" cy="100" r="3" fill="currentColor" />
      <rect x="164" y="92" width="8" height="16" rx="2" strokeOpacity="0.8" />
    </svg>
  );
}

function PerfumeGlyph() {
  return (
    <svg viewBox="0 0 200 200" className="relative h-[62%] w-[62%] text-gold/70" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="86" y="18" width="28" height="22" rx="3" strokeWidth="2" />
      <rect x="92" y="40" width="16" height="14" strokeOpacity="0.7" />
      <path d="M62 78 C62 62 78 54 100 54 C122 54 138 62 138 78 L142 160 C142 172 132 182 120 182 L80 182 C68 182 58 172 58 160 Z" strokeWidth="3" />
      <path d="M74 96 L126 96" strokeOpacity="0.5" />
      <rect x="76" y="104" width="48" height="44" rx="2" strokeOpacity="0.6" />
      <path d="M84 124 L116 124" strokeOpacity="0.5" />
      <path d="M70 84 C70 74 82 66 100 66" strokeOpacity="0.35" />
    </svg>
  );
}
