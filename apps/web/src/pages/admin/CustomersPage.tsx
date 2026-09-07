import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, ErrorState, PageLoader, Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { t } from '@/i18n/pt-BR';
import { ApiError, adminApi } from '@/lib/api';
import { formatBRL, formatPhoneBR, formatShortDate } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

const PAGE_SIZE = 20;

export default function CustomersPage() {
  usePageMeta(`${t('admin.customers')} · ${t('admin.title')}`);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const params = {
    page: Math.max(1, Number(searchParams.get('page')) || 1),
    pageSize: PAGE_SIZE,
    q: searchParams.get('q')?.trim() || undefined,
  };

  const [q, setQ] = useState(params.q ?? '');
  useEffect(() => {
    setQ(params.q ?? '');
  }, [params.q]);

  const query = useQuery({
    queryKey: ['admin', 'customers', params],
    queryFn: () => adminApi.customers(params),
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

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    update({ q: q.trim() || undefined });
  };

  const data = query.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="heading text-2xl">{t('admin.customers')}</h1>
        {data && (
          <span className="text-xs text-muted">
            {data.total} {data.total === 1 ? 'cliente' : 'clientes'}
            {query.isFetching && <Spinner size={12} className="ml-2 align-middle" />}
          </span>
        )}
      </div>

      <form onSubmit={submitSearch} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end" aria-label="Busca de clientes">
        <Input label={t('common.search')} name="q" type="search" placeholder="Nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} wrapperClassName="flex-1" />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" icon={<Search className="h-3.5 w-3.5" />}>
            {t('common.search')}
          </Button>
          {params.q && (
            <Button type="button" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => setSearchParams(new URLSearchParams())}>
              Limpar
            </Button>
          )}
        </div>
      </form>

      {query.isPending ? (
        <PageLoader />
      ) : query.isError ? (
        <ErrorState message={query.error instanceof ApiError ? query.error.message : undefined} onRetry={() => query.refetch()} />
      ) : !data || data.items.length === 0 ? (
        <div className="card">
          <EmptyState title="Nenhum cliente encontrado" text={params.q ? `Nenhum cliente corresponde a "${params.q}".` : 'Os clientes cadastrados na loja aparecerão aqui.'} />
        </div>
      ) : (
        <div className={`card transition-opacity ${query.isFetching ? 'opacity-70' : ''}`}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th className="text-right">Pedidos</th>
                  <th className="text-right">Total gasto</th>
                  <th>Cadastro</th>
                  <th>Último pedido</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a')) return;
                      navigate(`/admin/clientes/${customer.id}`);
                    }}
                  >
                    <td>
                      <Link to={`/admin/clientes/${customer.id}`} className="font-medium text-gold hover:underline">
                        {customer.name}
                      </Link>
                      {customer.newsletterOptIn && (
                        <Badge tone="gold" className="ml-2">
                          Newsletter
                        </Badge>
                      )}
                    </td>
                    <td className="max-w-[240px] truncate text-ivory/80">{customer.email}</td>
                    <td className="whitespace-nowrap text-ivory/80">{customer.phone ? formatPhoneBR(customer.phone) : '—'}</td>
                    <td className="text-right">{customer.ordersCount}</td>
                    <td className="whitespace-nowrap text-right font-medium">{formatBRL(customer.totalSpentCents)}</td>
                    <td className="whitespace-nowrap text-xs text-muted">{formatShortDate(customer.createdAt)}</td>
                    <td className="whitespace-nowrap text-xs text-muted">{customer.lastOrderAt ? formatShortDate(customer.lastOrderAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} label="clientes" onChange={(page) => update({ page: String(page) })} />
          </div>
        </div>
      )}
    </div>
  );
}
