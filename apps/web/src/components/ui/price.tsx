import { formatBRL } from '@vellor/shared';

interface PriceProps {
  cents: number;
  compareAtCents?: number | null;
  from?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' };

export function Price({ cents, compareAtCents, from, size = 'md', className = '' }: PriceProps) {
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-2 ${className}`}>
      {from && <span className="text-[10px] uppercase tracking-[0.15em] text-muted">a partir de</span>}
      <span className={`font-medium tracking-wide text-gold ${SIZE[size]}`}>{formatBRL(cents)}</span>
      {compareAtCents && compareAtCents > cents ? <span className="text-xs text-muted line-through">{formatBRL(compareAtCents)}</span> : null}
    </span>
  );
}
