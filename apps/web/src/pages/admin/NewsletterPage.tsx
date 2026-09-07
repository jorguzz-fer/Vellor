import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { EmptyState, ErrorState, PageLoader, Spinner } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n/pt-BR';
import { ApiError, adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

const PAGE_SIZE = 50;

const SOURCE_LABELS: Record<string, string> = {
  site: 'Site',
  footer: 'Rodapé da loja',
  home: 'Página inicial',
  checkout: 'Finalização de compra',
  register: 'Cadastro',
  account: 'Minha conta',
  contact: 'Atendimento',
};

export default function NewsletterPage() {
  usePageMeta(`${t('admin.newsletter')} · ${t('admin.title')}`);
  const [searchParams, setSearchParams] = useSearchParams();
  const params = { page: Math.max(1, Number(searchParams.get('page')) || 1), pageSize: PAGE_SIZE };

  const query = useQuery({
    queryKey: ['admin', 'newsletter', params],
    queryFn: () => adminApi.newsletter(params),
    placeholderData: keepPreviousData,
  });

  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    setSearchParams(next);
  };

  const data = query.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading text-2xl">{t('admin.newsletter')}</h1>
          {data && (
            <p className="mt-1 text-xs text-muted">
              {data.total} {data.total === 1 ? 'inscrito ativo' : 'inscritos ativos'}
              {query.isFetching && <Spinner size={12} className="ml-2 align-middle" />}
            </p>
          )}
        </div>
        <a href={adminApi.newsletterExportUrl} className="btn-secondary" download>
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </a>
      </div>

      {query.isPending ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : undefined}
          onRetry={() => query.refetch()}
        />
      ) : !data || data.items.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Nenhum inscrito"
            text="Os e-mails cadastrados na newsletter aparecerão aqui."
          />
        </div>
      ) : (
        <div className={`card transition-opacity ${query.isFetching ? 'opacity-70' : ''}`}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Nome</th>
                  <th>Origem</th>
                  <th>Consentimento</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((subscriber) => (
                  <tr key={subscriber.id}>
                    <td className="font-medium text-cream">{subscriber.email}</td>
                    <td className="text-ivory/80">{subscriber.name ?? '—'}</td>
                    <td className="text-ivory/80">
                      {SOURCE_LABELS[subscriber.source] ?? subscriber.source}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(subscriber.consentAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              label="inscritos"
              onChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
