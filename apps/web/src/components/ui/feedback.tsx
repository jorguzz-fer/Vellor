import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={`inline-block animate-spin rounded-full border-2 border-gold/30 border-t-gold ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function PageLoader({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted">
      <Spinner size={28} />
      <span className="text-xs uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  action,
  icon,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-gold/70">{icon}</div>}
      <h3 className="heading text-xl">{title}</h3>
      {text && <p className="mt-2 max-w-md text-sm text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <AlertTriangle className="h-6 w-6 text-danger" />
      <p className="text-sm text-ivory/80">{message ?? 'Algo deu errado. Tente novamente.'}</p>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

type Tone = 'gold' | 'success' | 'danger' | 'warning' | 'info' | 'muted';

const TONE_CLASS: Record<Tone, string> = {
  gold: 'border-gold/40 bg-gold/10 text-gold',
  success: 'border-success/40 bg-success/10 text-success',
  danger: 'border-danger/40 bg-danger/10 text-danger',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  info: 'border-info/40 bg-info/10 text-info',
  muted: 'border-line-strong bg-spruce text-ivory/70',
};

export function Badge({
  tone = 'muted',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const Icon =
    tone === 'danger' || tone === 'warning' ? AlertTriangle : tone === 'success' ? Check : Info;
  return (
    <div
      className={`flex items-start gap-2.5 rounded-sm border p-3 text-sm ${TONE_CLASS[tone]} ${className}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-ivory/90">{children}</div>
    </div>
  );
}

// ---------- Toasts ----------

interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastContextValue {
  toast: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, tone: Tone = 'gold') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-24 z-[100] flex w-[min(92vw,360px)] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-sm border bg-noir/95 px-4 py-3 text-xs tracking-wide shadow-2xl backdrop-blur animate-slide-in-right ${TONE_CLASS[t.tone]}`}
          >
            {t.tone === 'danger' ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <Check className="h-4 w-4 shrink-0" />
            )}
            <span className="flex-1 text-ivory">{t.message}</span>
            <button
              type="button"
              aria-label="Fechar"
              className="text-ivory/50 hover:text-ivory"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa de ToastProvider');
  return ctx;
}
