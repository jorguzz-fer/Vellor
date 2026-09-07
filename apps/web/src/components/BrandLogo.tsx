interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Logo oficial da Vellor ("V | VELLOR" em dourado, fundo transparente), gerado a partir da
 * arte original em public/brand/logo-source.jpg. As dimensões intrínsecas (483×166) evitam
 * salto de layout; a altura vem da classe e a largura acompanha a proporção.
 */
const HEIGHTS = {
  sm: 'h-8',
  md: 'h-10 md:h-11',
  lg: 'h-16 md:h-20',
};

export function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  return (
    <img
      src="/brand/logo-horizontal.png"
      alt="Vellor"
      width={483}
      height={166}
      decoding="async"
      draggable={false}
      className={`${HEIGHTS[size]} w-auto select-none ${className}`}
    />
  );
}
