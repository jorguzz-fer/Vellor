import { LinkButton } from '@/components/ui/button';
import { t } from '@/i18n/pt-BR';
import { usePageMeta } from '@/lib/meta';

export default function NotFoundPage() {
  usePageMeta(t('common.notFoundTitle'));
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <span className="eyebrow">404</span>
      <h1 className="heading mt-3 text-3xl">{t('common.notFoundTitle')}</h1>
      <p className="mt-3 text-sm text-muted">{t('common.notFoundText')}</p>
      <LinkButton to="/" className="mt-8">
        {t('common.backHome')}
      </LinkButton>
    </div>
  );
}
