import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageLoader, Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n/pt-BR';
import { ApiError, adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

const PAGE_SIZE = 50;

export default function AuditPage() {
  usePageMeta(`${t('admin.audit')} · ${t('admin.title')}`);
  const [searchParams, setSearchParams] = useSearchParams();

  const params = {
    page: Math.max(1, Number(searchParams.get('page')) || 1),
    pageSize: PAGE_SIZE,
    entity: searchParams.get('entity')?.trim().slice(0, 40) || undefined,
  };

  const [entity, setEntity] = useState(params.entity ?? '');
  useEffect(() => {
    setEntity(params.entity ?? '');
  }, [params.entity]);

  const query = useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () => adminApi.audit(params),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in patch)) next.delete('page');
    setSearchParams(next);
  };

  const submitFilter = (event: FormEvent) => {
    event.preventDefault();
    update({ entity: entity.trim() || undefined });
  };

  const data = query.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="heading text-2xl">{t('admin.audit')}</h1>
        {data && (
          <span className="text-xs text-muted">
            {data.total} {data.total === 1 ? 'registro' : 'registros'}
            {query.isFetching && <Spinner size={12} className="ml-2 align-middle" />}
          </span>
        )}
      </div>

      <form
        onSubmit={submitFilter}
        className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
        aria-label="Filtro de auditoria"
      >
        <Input
          label="Entidade"
          name="entity"
          type="search"
          placeholder="Ex.: order, product, coupon, settings"
          maxLength={40}
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          wrapperClassName="flex-1"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" icon={<Search className="h-3.5 w-3.5" />}>
            {t('common.filter')}
          </Button>
          {params.entity && (
            <Button
              type="button"
              variant="ghost"
              icon={<X className="h-3.5 w-3.5" />}
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              Limpar
            </Button>
          )}
        </div>
      </form>

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
            title="Nenhum registro"
            text={
              params.entity
                ? `Nenhuma ação registrada para a entidade "${params.entity}".`
                : 'As ações administrativas ficam registradas aqui.'
            }
          />
        </div>
      ) : (
        <div className={`card transition-opacity ${query.isFetching ? 'opacity-70' : ''}`}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>Ator</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th>ID</th>
                  <th>Resumo</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="max-w-[200px] truncate text-ivory/80">
                      {log.actorEmail ?? <span className="text-muted">sistema</span>}
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-gold">{log.action}</td>
                    <td>
                      <button
                        type="button"
                        className="font-mono text-xs text-ivory/80 hover:text-gold"
                        onClick={() => update({ entity: log.entity })}
                        title="Filtrar por esta entidade"
                      >
                        {log.entity}
                      </button>
                    </td>
                    <td className="font-mono text-xs text-muted" title={log.entityId ?? undefined}>
                      {log.entityId ? `${log.entityId.slice(0, 8)}…` : '—'}
                    </td>
                    <td className="min-w-[160px] max-w-md text-ivory/80">
                      <span className="line-clamp-2" title={log.summary ?? undefined}>
                        {log.summary ?? '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">
                      {log.ip ?? '—'}
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
              label="registros"
              onChange={(page) => update({ page: String(page) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
