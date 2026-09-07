import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);
}

function useInitialFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    return () => previous?.focus?.();
  }, [open]);
  return ref;
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'right' | 'left';
  width?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
  width = 'max-w-md',
}: DrawerProps) {
  useEscape(open, onClose);
  const ref = useInitialFocus(open);
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex bg-noir/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={`flex h-full w-full ${width} flex-col border-line bg-dark shadow-2xl ${side === 'right' ? 'ml-auto border-l animate-slide-in-right' : 'mr-auto border-r'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="heading text-lg">{title}</h2>
          <button
            type="button"
            aria-label="Fechar"
            className="rounded p-1.5 text-ivory/60 hover:text-ivory"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-line bg-noir/60 p-5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEscape(open, onClose);
  const ref = useInitialFocus(open);
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-noir/85 p-4 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={`card relative w-full ${SIZE[size]} max-h-[92vh] overflow-y-auto shadow-2xl animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded p-1.5 text-ivory/60 hover:text-ivory"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
        {title && (
          <div className="border-b border-line px-6 py-4 pr-12">
            <h2 className="heading text-lg">{title}</h2>
          </div>
        )}
        <div className="p-6">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line bg-noir/60 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel = 'Confirmar',
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {text && <div className="text-sm text-ivory/80">{text}</div>}
    </Modal>
  );
}
