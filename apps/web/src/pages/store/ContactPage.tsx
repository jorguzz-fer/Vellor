import { CONTACT_SUBJECT_LABELS, CONTACT_SUBJECTS, ContactInputSchema, DEFAULT_STORE_SETTINGS } from '@vellor/shared';
import { Check, Clock, Mail, MessageCircle, Send, Tag, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useSearchParams } from 'react-router';
import { whatsappLink } from '@/components/store/WhatsAppButton';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { contactApi } from '@/lib/api';
import { formatPhoneBR, maskPhoneInput } from '@/lib/format';
import { useZodForm } from '@/lib/forms';
import { usePageMeta } from '@/lib/meta';
import { useSettings } from '@/lib/queries';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGE_MAX = 2000;

const SUBJECT_OPTIONS = CONTACT_SUBJECTS.map((subject) => ({ value: subject, label: CONTACT_SUBJECT_LABELS[subject] }));

function initialValues(productId: string | undefined): Record<string, unknown> {
  return {
    name: '',
    email: '',
    phone: undefined,
    subject: 'duvida',
    message: '',
    productId,
    consent: false,
    website: '',
  };
}

export default function ContactPage() {
  usePageMeta(t('contact.title'), t('contact.text'));
  const { data: settings } = useSettings();
  const store = settings?.store ?? DEFAULT_STORE_SETTINGS.store;

  const [searchParams, setSearchParams] = useSearchParams();
  const productParam = searchParams.get('produto');
  const productId = productParam && UUID_RE.test(productParam) ? productParam : undefined;

  const [sent, setSent] = useState(false);
  const form = useZodForm(ContactInputSchema, initialValues(productId));
  const linkedProductId = typeof form.values.productId === 'string' ? form.values.productId : undefined;
  const messageLength = String(form.values.message ?? '').length;

  const submit = form.handleSubmit(async (data) => {
    await contactApi.send(data);
    setSent(true);
  });

  const removeProduct = () => {
    form.setField('productId', undefined);
    const next = new URLSearchParams(searchParams);
    next.delete('produto');
    setSearchParams(next, { replace: true });
  };

  const startAnother = () => {
    form.reset(initialValues(linkedProductId));
    setSent(false);
  };

  const whatsappMessage = linkedProductId ? `Olá! Tenho uma dúvida sobre uma peça da ${store.name || 'Vellor'}.` : `Olá! Gostaria de falar com a ${store.name || 'Vellor'}.`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <header className="mb-10 max-w-2xl">
        <span className="eyebrow">{t('nav.contact')}</span>
        <h1 className="heading mt-2 text-3xl md:text-4xl">{t('contact.title')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ivory/80">{t('contact.text')}</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-12">
        {/* Canais */}
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-4 lg:grid-cols-1 lg:content-start">
          <ChannelCard icon={<MessageCircle className="h-4 w-4" />} title="WhatsApp">
            <p className="text-sm text-cream">{store.whatsapp ? formatPhoneBR(store.whatsapp) : '—'}</p>
            {store.whatsapp && (
              <LinkButton to={whatsappLink(store.whatsapp, whatsappMessage)} external size="sm" className="mt-3" icon={<MessageCircle className="h-3.5 w-3.5" />}>
                {t('contact.whatsapp')}
              </LinkButton>
            )}
          </ChannelCard>
          <ChannelCard icon={<Mail className="h-4 w-4" />} title={t('contact.emailLabel')}>
            {store.email ? (
              <a href={`mailto:${store.email}`} className="link break-all text-sm">
                {store.email}
              </a>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </ChannelCard>
          <ChannelCard icon={<Clock className="h-4 w-4" />} title={t('contact.hours')}>
            <p className="text-sm text-cream">{store.businessHours || DEFAULT_STORE_SETTINGS.store.businessHours}</p>
            <p className="mt-1 text-xs text-muted">Sem loja física: atendimento pessoal e sob agendamento.</p>
          </ChannelCard>
        </div>

        {/* Formulário */}
        <div className="lg:col-span-8">
          {sent ? (
            <div className="card flex flex-col items-center px-6 py-12 text-center" role="status" data-testid="contact-success">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-success/50 text-success" aria-hidden="true">
                <Check className="h-5 w-5" />
              </span>
              <h2 className="heading mt-5 text-2xl">{t('contact.sent')}</h2>
              <p className="mt-2 max-w-md text-sm text-muted">Se preferir uma resposta imediata, fale agora pelo WhatsApp em {store.businessHours.toLowerCase()}.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button variant="secondary" onClick={startAnother}>
                  Enviar outra mensagem
                </Button>
                <LinkButton to="/" variant="ghost">
                  {t('common.backHome')}
                </LinkButton>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="card space-y-5 p-6 md:p-8" data-testid="contact-form">
              <div>
                <h2 className="heading text-2xl">{t('contact.formTitle')}</h2>
                <p className="mt-1 text-xs text-muted">
                  Campos marcados com <span className="text-gold">*</span> são obrigatórios.
                </p>
              </div>

              {linkedProductId && (
                <Field label={t('contact.product')}>
                  <div className="flex items-center justify-between gap-3 rounded-sm border border-gold/40 bg-gold/5 px-3 py-2.5 text-sm">
                    <span className="flex items-center gap-2 text-ivory/90">
                      <Tag className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                      Sua mensagem será vinculada à peça que você estava vendo.
                    </span>
                    <button type="button" onClick={removeProduct} className="shrink-0 p-1 text-ivory/50 hover:text-danger" aria-label="Remover produto de interesse">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </Field>
              )}

              {form.formError && <Alert tone="danger">{form.formError}</Alert>}

              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  name="name"
                  label={t('account.name')}
                  required
                  autoComplete="name"
                  value={String(form.values.name ?? '')}
                  onChange={(e) => form.setField('name', e.target.value)}
                  error={form.errors.name}
                />
                <Input
                  name="email"
                  type="email"
                  label={t('contact.emailLabel')}
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={String(form.values.email ?? '')}
                  onChange={(e) => form.setField('email', e.target.value)}
                  error={form.errors.email}
                />
                <Input
                  name="phone"
                  type="tel"
                  label={`${t('account.phone')} (${t('common.optional')})`}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="(11) 99999-9999"
                  value={String(form.values.phone ?? '')}
                  onChange={(e) => form.setField('phone', maskPhoneInput(e.target.value) || undefined)}
                  error={form.errors.phone}
                />
                <Select
                  name="subject"
                  label={t('contact.subject')}
                  required
                  options={SUBJECT_OPTIONS}
                  value={String(form.values.subject ?? 'duvida')}
                  onChange={(e) => form.setField('subject', e.target.value)}
                  error={form.errors.subject ? 'Selecione o assunto' : undefined}
                />
              </div>

              <Textarea
                name="message"
                label={t('contact.message')}
                required
                rows={6}
                maxLength={MESSAGE_MAX}
                value={String(form.values.message ?? '')}
                onChange={(e) => form.setField('message', e.target.value)}
                error={form.errors.message}
                hint={`${messageLength}/${MESSAGE_MAX}`}
              />

              {/* Honeypot: fica fora da tela e deve permanecer vazio. */}
              <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={String(form.values.website ?? '')}
                  onChange={(e) => form.setField('website', e.target.value)}
                />
              </div>

              <Checkbox
                name="consent"
                label={t('contact.consent')}
                checked={Boolean(form.values.consent)}
                onChange={(e) => form.setField('consent', e.target.checked)}
                error={form.errors.consent}
              />

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted">Seus dados são usados apenas para responder a esta mensagem.</p>
                <Button type="submit" loading={form.submitting} icon={<Send className="h-4 w-4" />} className="w-full sm:w-auto">
                  {t('contact.send')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="card p-5">
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
        <span aria-hidden="true">{icon}</span> {title}
      </span>
      <div className="mt-2">{children}</div>
    </div>
  );
}
