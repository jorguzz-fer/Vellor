import { ArrowRight, Check } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { t } from '@/i18n/pt-BR';
import { ApiError, contactApi } from '@/lib/api';

export function NewsletterForm({ source }: { source: string }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError(t('home.newsletterConsent'));
      return;
    }
    setLoading(true);
    try {
      await contactApi.newsletter({ email, consent: true, source });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <p className="flex items-center gap-2 text-xs text-gold">
        <Check className="h-4 w-4" /> {t('home.newsletterDone')}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="newsletter-form">
      <div className="relative">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('home.newsletterPlaceholder')}
          className="w-full border-b border-line-strong bg-transparent pb-2 pr-8 text-sm text-cream placeholder:text-muted/70 focus:border-gold focus:outline-none"
          aria-label={t('home.newsletterPlaceholder')}
        />
        <button type="submit" className="absolute right-0 top-0 text-ivory/60 hover:text-gold" aria-label={t('home.newsletterButton')} disabled={loading}>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-[11px] text-muted">
        <input type="checkbox" className="mt-0.5 accent-gold" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          {t('home.newsletterConsent').replace('Política de Privacidade.', '')}
          <Link to="/privacidade" className="link">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
