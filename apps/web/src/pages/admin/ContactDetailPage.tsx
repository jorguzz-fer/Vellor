import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CONTACT_STATUS_LABELS,
  CONTACT_STATUSES,
  CONTACT_SUBJECT_LABELS,
  type ContactRequest,
  type ContactRequestUpdate,
  type ContactStatus,
  type ContactSubject,
} from '@vellor/shared';
import { ArrowLeft, Mail, MessageCircle, Package, Phone } from 'lucide-react';
import { type ComponentProps, type FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router';
import { whatsappLink } from '@/components/store/WhatsAppButton';
import { Button, LinkButton } from '@/components/ui/button';
import { Badge, ErrorState, PageLoader, useToast } from '@/components/ui/feedback';
import { Select, Textarea } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { ApiError, adminApi } from '@/lib/api';
import { formatDateTime, formatPhoneBR } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

type Tone = NonNullable<ComponentProps<typeof Badge>['tone']>;

const STATUS_TONE: Record<ContactStatus, Tone> = {
  new: 'warning',
  in_progress: 'info',
  answered: 'success',
  closed: 'muted',
};

function subjectLabel(subject: string): string {
  return (CONTACT_SUBJECT_LABELS as Record<string, string>)[subject as ContactSubject] ?? subject;
}

/** Número brasileiro (DDD + número) no formato internacional exigido pelo wa.me. */
function internationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length <= 11 ? `55${digits}` : digits;
}

export default function ContactDetailPage() {
  const { id = '' } = useParams();
  const query = useQuery({ queryKey: ['admin', 'contact', id], queryFn: () => adminApi.contact(id), enabled: Boolean(id) });
  usePageMeta(query.data ? `${query.data.name} · ${t('admin.contacts')}` : `${t('admin.contacts')} · ${t('admin.title')}`);

  if (query.isPending) return <PageLoader />;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <ErrorState message={query.error instanceof ApiError ? query.error.message : undefined} onRetry={() => query.refetch()} />
        <div className="text-center">
          <LinkButton to="/admin/atendimento" variant="secondary">
            {t('common.back')}
          </LinkButton>
        </div>
      </div>
    );
  }

  const contact = query.data;
  const firstName = contact.name.trim().split(/\s+/)[0] ?? contact.name;
  const whatsappMessage = `Olá, ${firstName}! Aqui é da Vellor, sobre a sua mensagem de atendimento${contact.productName ? ` a respeito de ${contact.productName}` : ''}.`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/atendimento" className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-gold">
            <ArrowLeft className="h-3.5 w-3.5" /> {t('admin.contacts')}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="heading text-2xl">{contact.name}</h1>
            <Badge tone={STATUS_TONE[contact.status]}>{CONTACT_STATUS_LABELS[contact.status]}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Recebida em {formatDateTime(contact.createdAt)}
            {contact.updatedAt !== contact.createdAt ? ` · Atualizada em ${formatDateTime(contact.updatedAt)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Vellor – ${subjectLabel(contact.subject)}`)}`} className="btn-secondary">
            <Mail className="h-3.5 w-3.5" /> Responder por e-mail
          </a>
          {contact.phone && (
            <a href={whatsappLink(internationalPhone(contact.phone), whatsappMessage)} target="_blank" rel="noreferrer" className="btn-primary">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5" aria-label="Mensagem">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="heading text-lg">{t('contact.message')}</h2>
              <span className="text-xs text-muted">
                {t('contact.subject')}: <span className="text-ivory/90">{subjectLabel(contact.subject)}</span>
              </span>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ivory/90">{contact.message}</p>
          </section>

          {(contact.productName || contact.productId) && (
            <section className="card flex items-center gap-4 p-5" aria-label="Produto de interesse">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-gold/40 bg-gold/10 text-gold">
                <Package className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t('contact.product')}</p>
                {contact.productId ? (
                  <Link to={`/admin/produtos/${contact.productId}`} className="link block truncate text-sm">
                    {contact.productName ?? 'Ver produto'}
                  </Link>
                ) : (
                  <p className="truncate text-sm text-cream">{contact.productName}</p>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="card p-5" aria-label="Dados do cliente">
            <h2 className="heading mb-4 text-lg">Contato</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Nome</dt>
                <dd className="text-ivory/90">{contact.name}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t('contact.emailLabel')}</dt>
                <dd>
                  <a href={`mailto:${contact.email}`} className="link inline-flex items-center gap-1.5 break-all">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {contact.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t('account.phone')}</dt>
                <dd>
                  {contact.phone ? (
                    <span className="flex flex-wrap items-center gap-3">
                      <a href={`tel:+${internationalPhone(contact.phone)}`} className="link inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> {formatPhoneBR(contact.phone)}
                      </a>
                      <a href={whatsappLink(internationalPhone(contact.phone), whatsappMessage)} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1.5 text-xs">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </span>
                  ) : (
                    <span className="text-muted">Não informado</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <ContactForm key={`${contact.id}:${contact.updatedAt}`} contact={contact} />
        </div>
      </div>
    </div>
  );
}

function ContactForm({ contact }: { contact: ContactRequest }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [notes, setNotes] = useState(contact.internalNotes ?? '');

  const mutation = useMutation({
    mutationFn: (input: ContactRequestUpdate) => adminApi.updateContact(contact.id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'contact', contact.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      toast('Atendimento atualizado.', 'success');
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'Não foi possível salvar. Tente novamente.', 'danger'),
  });

  const dirty = status !== contact.status || notes.trim() !== (contact.internalNotes ?? '').trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!dirty) return;
    mutation.mutate({ status, internalNotes: notes.trim() || null });
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5" aria-label="Atualizar atendimento">
      <h2 className="heading text-lg">Atendimento</h2>
      <Select
        label={t('common.status')}
        name="status"
        value={status}
        onChange={(e) => setStatus(e.target.value as ContactStatus)}
        options={CONTACT_STATUSES.map((s) => ({ value: s, label: CONTACT_STATUS_LABELS[s] }))}
      />
      <Textarea
        label="Notas internas"
        name="internalNotes"
        hint="Visível apenas para a equipe."
        maxLength={2000}
        rows={5}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{notes.length}/2000</span>
        <Button type="submit" loading={mutation.isPending} disabled={!dirty}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
