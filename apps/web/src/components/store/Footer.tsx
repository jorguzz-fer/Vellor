import { Link } from 'react-router';
import { BrandLogo } from '@/components/BrandLogo';
import { t } from '@/i18n/pt-BR';
import { formatCNPJ, formatPhoneBR } from '@/lib/format';
import { useSettings } from '@/lib/queries';
import { NewsletterForm } from './NewsletterForm';

export function Footer() {
  const { data: settings } = useSettings();
  const store = settings?.store;
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-noir px-4 pb-8 pt-14 text-ivory sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-10 border-b border-line pb-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <h3 className="heading text-xl">{t('home.newsletterTitle')}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t('home.newsletterText')}</p>
            <div className="mt-5 max-w-sm">
              <NewsletterForm source="footer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:col-span-7">
            <FooterColumn
              title={t('footer.shop')}
              links={[
                { to: '/relogios', label: t('nav.watches') },
                { to: '/perfumes', label: t('nav.perfumes') },
                { to: '/favoritos', label: t('nav.wishlist') },
                { to: '/sacola', label: t('nav.cart') },
              ]}
            />
            <FooterColumn
              title={t('footer.help')}
              links={[
                { to: '/atendimento', label: t('nav.contact') },
                { to: '/trocas', label: t('legal.exchanges') },
                { to: '/termos', label: t('legal.terms') },
                { to: '/conta', label: t('nav.account') },
              ]}
            />
            <FooterColumn
              title={t('footer.company')}
              links={[
                { to: '/sobre', label: t('footer.about') },
                { to: '/privacidade', label: t('legal.privacy') },
              ]}
            >
              {store && (
                <address className="mt-4 text-[11px] not-italic leading-relaxed text-muted">
                  {store.legalName}
                  <br />
                  {t('footer.cnpj')} {formatCNPJ(store.cnpj)}
                  <br />
                  {store.address.street}, {store.address.number}
                  {store.address.complement ? ` – ${store.address.complement}` : ''}
                  <br />
                  {store.address.district} · {store.address.city}/{store.address.state} · CEP{' '}
                  {store.address.cep}
                  <br />
                  {store.email} · {formatPhoneBR(store.phone)}
                </address>
              )}
            </FooterColumn>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-[11px] text-muted sm:flex-row">
          <span>
            © {year} {store?.name ?? 'Vellor'} · {t('footer.rights')}
          </span>
          <BrandLogo size="sm" showTagline={false} />
          <span className="text-center sm:text-right">
            {t('footer.payments')}
            <br />
            {t('footer.shipping')}
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  children,
}: {
  title: string;
  links: Array<{ to: string; label: string }>;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-gold">{title}</h4>
      <ul className="space-y-2.5 text-xs text-ivory/70">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="hover:text-gold">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}
