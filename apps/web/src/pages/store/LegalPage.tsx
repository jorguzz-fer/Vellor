import { FileText } from 'lucide-react';
import { NavLink } from 'react-router';
import { Alert, EmptyState, ErrorState, PageLoader } from '@/components/ui/feedback';
import { type MessageKey, t } from '@/i18n/pt-BR';
import { usePageMeta } from '@/lib/meta';
import { useSettings } from '@/lib/queries';

type LegalKind = 'privacyPolicy' | 'termsOfService' | 'exchangePolicy';

const PAGES: Array<{ kind: LegalKind; titleKey: MessageKey; path: string }> = [
  { kind: 'privacyPolicy', titleKey: 'legal.privacy', path: '/privacidade' },
  { kind: 'termsOfService', titleKey: 'legal.terms', path: '/termos' },
  { kind: 'exchangePolicy', titleKey: 'legal.exchanges', path: '/trocas' },
];

const PLACEHOLDER_MARK = '‹decidir›';

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const current = PAGES.find((p) => p.kind === kind) ?? PAGES[0]!;
  const title = t(current.titleKey);
  usePageMeta(title);

  const settings = useSettings();
  const body = settings.data?.legal[kind]?.trim() ?? '';
  const provisional = body.includes(PLACEHOLDER_MARK);
  const storeName = settings.data?.store.name || 'Vellor';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="grid gap-10 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <span className="eyebrow">{t('footer.company')}</span>
          <nav aria-label="Documentos legais" className="mt-3 flex gap-2 overflow-x-auto scrollbar-none lg:flex-col lg:overflow-visible">
            {PAGES.map((page) => (
              <NavLink
                key={page.kind}
                to={page.path}
                className={({ isActive }) =>
                  `shrink-0 rounded-sm border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                    isActive ? 'border-gold bg-gold/10 text-gold' : 'border-line text-ivory/80 hover:border-line-strong hover:text-gold'
                  }`
                }
              >
                {t(page.titleKey)}
              </NavLink>
            ))}
          </nav>
        </aside>

        <article className="lg:col-span-9">
          <h1 className="heading text-3xl md:text-4xl">{title}</h1>

          {settings.isPending ? (
            <PageLoader />
          ) : settings.isError ? (
            <div className="mt-8">
              <ErrorState message={settings.error.message} onRetry={() => settings.refetch()} />
            </div>
          ) : (
            <>
              {provisional && (
                <Alert tone="warning" className="mt-6">
                  Conteúdo provisório: este texto ainda está sendo finalizado pela {storeName} e pode ser alterado. Em caso de dúvida, fale com o atendimento antes de
                  concluir a compra.
                </Alert>
              )}
              {body ? (
                <div className="card mt-6 px-6 py-8 md:px-10 md:py-10">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ivory/85">{body}</p>
                </div>
              ) : (
                <EmptyState icon={<FileText className="h-10 w-10" />} title="Documento em elaboração" text={`A ${storeName} ainda não publicou este documento. Fale com o atendimento se precisar de informações.`} />
              )}
            </>
          )}
        </article>
      </div>
    </div>
  );
}
