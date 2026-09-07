import { DEFAULT_STORE_SETTINGS } from '@vellor/shared';
import { ArrowRight, Clock, CreditCard, Gem, Mail, MessageCircle, PenLine, ShieldCheck, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { whatsappLink } from '@/components/store/WhatsAppButton';
import { LinkButton } from '@/components/ui/button';
import { t } from '@/i18n/pt-BR';
import { formatPhoneBR } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';
import { useSettings } from '@/lib/queries';

const DESCRIPTION = 'Curadoria de relógios de luxo e perfumes de nicho com autenticidade verificada, atendimento pessoal e envio segurado para todo o Brasil.';

export default function AboutPage() {
  usePageMeta(t('footer.about'), DESCRIPTION);
  const { data: settings } = useSettings();
  const store = settings?.store ?? DEFAULT_STORE_SETTINGS.store;
  const payments = settings?.payments ?? DEFAULT_STORE_SETTINGS.payments;
  const handlingDays = settings?.shipping.handlingDays ?? DEFAULT_STORE_SETTINGS.shipping.handlingDays;
  const name = store.name || 'Vellor';

  const pillars: Array<{ icon: ReactNode; title: string; text: string }> = [
    {
      icon: <Gem className="h-4 w-4" />,
      title: 'Curadoria, não estoque',
      text: `Selecionamos poucas peças por vez: relógios de alta relojoaria e perfumes de casas autorais, escolhidos por procedência, estado de conservação e relevância. Cada item que entra na ${name} passou primeiro pelo nosso próprio crivo.`,
    },
    {
      icon: <ShieldCheck className="h-4 w-4" />,
      title: 'Autenticidade verificada',
      text: 'Relógios passam por verificação de especialistas (caixa, movimento, referência, documentos e histórico). Perfumes vêm de fontes autorizadas e são conferidos lote a lote. Toda compra sai com nota fiscal e, quando disponíveis, certificado e embalagem originais.',
    },
    {
      icon: <MessageCircle className="h-4 w-4" />,
      title: 'Sem loja física, com atendimento pessoal',
      text: 'Não mantemos showroom aberto ao público. O atendimento é feito de forma pessoal, por WhatsApp e e-mail, por um consultor que acompanha você antes, durante e depois da compra, com fotos, vídeos e detalhes adicionais sempre que precisar.',
    },
    {
      icon: <Truck className="h-4 w-4" />,
      title: 'Envio segurado pelos Correios',
      text: `Postamos pelos Correios com seguro do valor total da peça e embalagem discreta, para todo o Brasil, em até ${handlingDays} ${handlingDays === 1 ? 'dia útil' : 'dias úteis'} após a confirmação do pagamento. O código de rastreio chega por e-mail.`,
    },
    {
      icon: <CreditCard className="h-4 w-4" />,
      title: 'Pagamento seguro via Asaas',
      text: `Pix, boleto ou cartão de crédito em até ${payments.maxInstallments}x, processados pelo Asaas em ambiente certificado. Os dados do seu cartão não passam pelos nossos servidores.`,
    },
    {
      icon: <Clock className="h-4 w-4" />,
      title: 'Horário de atendimento',
      text: `${store.businessHours || DEFAULT_STORE_SETTINGS.store.businessHours}. Fora desse horário, deixe sua mensagem: respondemos assim que possível.`,
    },
  ];

  const steps = [
    { title: 'Escolha', text: 'Navegue pela curadoria de relógios e perfumes e salve suas peças favoritas.' },
    { title: 'Tire dúvidas', text: 'Fale com um consultor pelo WhatsApp ou pelo formulário de atendimento antes de decidir.' },
    { title: 'Pague com segurança', text: 'Finalize com Pix, boleto ou cartão pelo Asaas. Você recebe a confirmação por e-mail.' },
    { title: 'Receba com seguro', text: 'A peça é postada pelos Correios com seguro do valor total e rastreio até a sua porta.' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      {/* Abertura */}
      <header className="relative overflow-hidden rounded-sm border border-line bg-noir px-6 py-14 md:px-12 md:py-20">
        <div className="absolute inset-0 bg-linear-to-br from-spruce via-noir to-noir" aria-hidden="true" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-12 bottom-[-6rem] hidden h-72 w-72 rounded-full border border-gold/15 md:block" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <span className="eyebrow">{t('footer.company')}</span>
          <h1 className="heading mt-3 text-4xl md:text-5xl">{t('nav.about')}</h1>
          <p className="mt-5 text-sm leading-relaxed text-ivory/85 md:text-base">
            A {name} é uma curadoria independente de relógios de luxo e perfumes de nicho, feita para quem valoriza autenticidade, discrição e atendimento pessoal. Poucas peças, escolhidas com critério, e um consultor ao seu lado do primeiro contato à entrega.
          </p>
        </div>
      </header>

      {/* História e fundadores (a completar pelo cliente) */}
      <section className="mt-14 grid gap-8 lg:grid-cols-12" aria-labelledby="history-heading">
        <div className="lg:col-span-4">
          <span className="eyebrow">Origem</span>
          <h2 id="history-heading" className="heading mt-2 text-2xl md:text-3xl">
            Nossa história
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Os trechos marcados abaixo aguardam o texto definitivo da {name}: a história da marca e a apresentação de quem faz a curadoria.
          </p>
        </div>
        <div className="space-y-4 lg:col-span-8">
          <Placeholder title="A história da marca">
            ‹decidir› Conte aqui como a {name} nasceu: o que motivou a curadoria, a relação com relógios e perfumes, o momento em que a paixão virou ofício e o que
            diferencia a seleção de tudo o que existe no mercado.
          </Placeholder>
          <Placeholder title="Quem faz a curadoria">
            ‹decidir› Apresente os fundadores: nomes, trajetória no universo da relojoaria e da perfumaria, formações e certificações, e o papel de cada um na
            seleção e verificação das peças.
          </Placeholder>
        </div>
      </section>

      {/* Pilares */}
      <section className="mt-14" aria-labelledby="pillars-heading">
        <span className="eyebrow">Compromissos</span>
        <h2 id="pillars-heading" className="heading mt-2 text-2xl md:text-3xl">
          Como trabalhamos
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <li key={pillar.title} className="card flex gap-4 p-6">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold" aria-hidden="true">
                {pillar.icon}
              </span>
              <div>
                <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-cream">{pillar.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{pillar.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Como comprar */}
      <section className="mt-14 rounded-sm border border-line bg-dark/60 p-6 md:p-10" aria-labelledby="steps-heading">
        <span className="eyebrow">Passo a passo</span>
        <h2 id="steps-heading" className="heading mt-2 text-2xl md:text-3xl">
          Como comprar na {name}
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="relative border-l border-gold/40 pl-5">
              <span className="font-display text-3xl leading-none text-gold">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-cream">{step.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Contato */}
      <section className="mt-14 grid gap-8 border-t border-line pt-10 lg:grid-cols-12" aria-labelledby="contact-heading">
        <div className="lg:col-span-5">
          <span className="eyebrow">{t('nav.contact')}</span>
          <h2 id="contact-heading" className="heading mt-2 text-2xl md:text-3xl">
            Fale com um consultor
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Quer ver mais fotos, confirmar um detalhe ou receber uma indicação? Chame no WhatsApp ou escreva para o nosso e-mail. Sem loja física, o atendimento
            é sempre direto e pessoal.
          </p>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
              </span>
              <p className="mt-2 text-sm text-cream">{store.whatsapp ? formatPhoneBR(store.whatsapp) : '—'}</p>
              <p className="mt-1 text-xs text-muted">{store.businessHours}</p>
            </div>
            <div className="card p-5">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                <Mail className="h-4 w-4" aria-hidden="true" /> {t('contact.emailLabel')}
              </span>
              <p className="mt-2 text-sm">
                {store.email ? (
                  <a href={`mailto:${store.email}`} className="link break-all">
                    {store.email}
                  </a>
                ) : (
                  '—'
                )}
              </p>
              <p className="mt-1 text-xs text-muted">Respondemos em horário comercial.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {store.whatsapp && (
              <LinkButton to={whatsappLink(store.whatsapp, `Olá! Gostaria de conhecer a curadoria da ${name}.`)} external icon={<MessageCircle className="h-4 w-4" />}>
                {t('contact.whatsapp')}
              </LinkButton>
            )}
            <LinkButton to="/atendimento" variant="secondary" icon={<ArrowRight className="h-4 w-4" />}>
              {t('contact.formTitle')}
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Catálogo */}
      <section className="mt-14 grid gap-4 sm:grid-cols-2" aria-label="Explorar a curadoria">
        <CatalogLink to="/relogios" title={t('home.watchesTitle')} text={t('home.watchesText')} />
        <CatalogLink to="/perfumes" title={t('home.perfumesTitle')} text={t('home.perfumesText')} />
      </section>
    </div>
  );
}

/** Trecho que o cliente ainda precisa escrever; o marcador "‹decidir›" fica visível para facilitar a revisão. */
function Placeholder({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-sm border border-dashed border-warning/50 bg-warning/5 p-5">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-warning">
        <PenLine className="h-3.5 w-3.5" aria-hidden="true" /> {title} · a completar
      </span>
      <p className="mt-2 text-sm leading-relaxed text-ivory/80">{children}</p>
    </div>
  );
}

function CatalogLink({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <LinkButton to={to} variant="secondary" className="!justify-between !px-6 !py-5 text-left normal-case tracking-normal">
      <span>
        <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-cream">{title}</span>
        <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-muted">{text}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-gold" />
    </LinkButton>
  );
}
