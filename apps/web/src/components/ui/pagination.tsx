import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  onChange: (page: number) => void;
  label?: string;
}

export function Pagination({ page, totalPages, total, onChange, label }: PaginationProps) {
  if (totalPages <= 1 && !total) return null;
  return (
    <nav
      className="flex items-center justify-between gap-4 py-4 text-xs text-muted"
      aria-label="Paginação"
    >
      <span>
        {total !== undefined ? `${total} ${label ?? 'itens'} · ` : ''}Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-ghost px-2"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`h-8 w-8 rounded-sm text-xs ${p === page ? 'bg-gold font-bold text-noir' : 'text-ivory/70 hover:text-gold'}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="btn-ghost px-2"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

function pageWindow(page: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push(null);
    out.push(sorted[i]!);
  }
  return out;
}
