import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CONTACT_STATUS_LABELS, CONTACT_STATUSES, CONTACT_SUBJECT_LABELS, type ContactStatus, type ContactSubject } from '@vellor/shared';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState, PageLoader, Spinner } from '@/components/ui/feedback';
import { Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n/pt-BR';
import { ApiError, adminApi } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

type Tone = NonNullable<ComponentProps<typeof Badge>['tone']>;

const STATUS_TONE: Record<ContactStatus, Tone> = {
  new: 'warning',
  in_progress: 'info',
  answered: 'success',
  closed: 'muted',
};

const PAGE_SIZE = 20;

function subjectLabel(subject: string): string {
  return (CONTACT_SUBJECT_LABELS as Record<string, string>)[subject as ContactSubject] ?? subject;
}

export default function ContactsPage() {
  usePageMeta(`${t('admin.contacts')} · ${t('admin.title')}`);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get('status');
  const params = {
    page: Math.max(1, Number(searchParams.get('page')) || 1),
    pageSize: PAGE_SIZE,
    status: statusParam && (CONTACT_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as ContactStatus) : undefined,
  };

  const query = useQuery({
    queryKey: ['admin', 'contacts', params],
    queryFn: () => adminApi.contacts(params),
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

  const data = query.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="heading text-2xl">{t('admin.contacts')}</h1>
        {data && (
          <span className="text-xs text-muted">
            {data.total} {data.total === 1 ? 'mensagem' : 'mensagens'}
            {query.isFetching && <Spinner size={12} className="ml-2 align-middle" />}
          </span>
        )}
      </div>

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end" role="group" aria-label="Filtros de atendimento">
        <Select
          label={t('common.status')}
          name="status"
          value={params.status ?? ''}
          onChange={(e) => update({ status: e.target.value || undefined })}
          placeholder={t('common.all')}
          options={CONTACT_STATUSES.map((s) => ({ value: s, label: CONTACT_STATUS_LABELS[s] }))}
          wrapperClassName="w-full sm:max-w-xs"
        />
        {params.status && (
          <Button type="button" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => setSearchParams(new URLSearchParams())}>
            {t('common.clearFilters')}
          </Button>
        )}
      </div>

      {query.isPending ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState message={query.error instanceof ApiError ? query.error.message : undefined} onRetry={() => query.refetch()} />
      ) : !data || data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="Nenhuma mensagem" text={params.status ? `Não há mensagens com status "${CONTACT_STATUS_LABELS[params.status]}".` : 'As mensagens enviadas pelo formulário de atendimento aparecerão aqui.'} />
        </div>
      ) : (
        <div className={`card transition-opacity ${query.isFetching ? 'opacity-70' : ''}`}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>{t('contact.subject')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((contact) => (
                  <tr
                    key={contact.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a')) return;
                      navigate(`/admin/atendimento/${contact.id}`);
                    }}
                  >
                    <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(contact.createdAt)}</td>
                    <td>
                      <Link to={`/admin/atendimento/${contact.id}`} className={`hover:underline ${contact.status === 'new' ? 'font-semibold text-cream' : 'font-medium text-gold'}`}>
                        {contact.name}
                      </Link>
                      {contact.productName && <span className="block max-w-[220px] truncate text-xs text-muted">{contact.productName}</span>}
                    </td>
                    <td className="max-w-[240px] truncate text-ivory/80">{contact.email}</td>
                    <td className="text-ivory/80">{subjectLabel(contact.subject)}</td>
                    <td>
                      <Badge tone={STATUS_TONE[contact.status]}>{CONTACT_STATUS_LABELS[contact.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} label="mensagens" onChange={(page) => update({ page: String(page) })} />
          </div>
        </div>
      )}
    </div>
  );
}
