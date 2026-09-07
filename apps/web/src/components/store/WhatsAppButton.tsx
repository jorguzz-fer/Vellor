import { MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router';
import { useSettings } from '@/lib/queries';

export function whatsappLink(number: string, message?: string): string {
  const digits = number.replace(/\D/g, '');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}

export function WhatsAppButton() {
  const { data: settings } = useSettings();
  const { pathname } = useLocation();
  if (!settings?.store.whatsapp || pathname.startsWith('/checkout')) return null;
  return (
    <a
      href={whatsappLink(settings.store.whatsapp, 'Olá! Gostaria de falar com a Vellor.')}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-6 right-6 z-30 flex items-center gap-2.5 rounded-full border border-gold/50 bg-dark px-4 py-3 text-gold shadow-2xl backdrop-blur transition-transform hover:scale-105 hover:bg-gold hover:text-noir"
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] sm:inline">
        Atendimento
      </span>
    </a>
  );
}
