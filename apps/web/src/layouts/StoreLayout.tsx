import { useEffect } from 'react';
import { Outlet, useLocation, useRouteError } from 'react-router';
import { CartDrawer } from '@/components/store/CartDrawer';
import { Footer } from '@/components/store/Footer';
import { Navbar } from '@/components/store/Navbar';
import { WhatsAppButton } from '@/components/store/WhatsAppButton';
import { LinkButton } from '@/components/ui/button';
import { t } from '@/i18n/pt-BR';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function RouteError() {
  const error = useRouteError() as { status?: number; message?: string } | undefined;
  const notFound = error?.status === 404;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <span className="eyebrow">{notFound ? '404' : 'Erro'}</span>
      <h1 className="heading mt-3 text-3xl">
        {notFound ? t('common.notFoundTitle') : t('common.error')}
      </h1>
      {!notFound && error?.message && <p className="mt-3 text-xs text-muted">{error.message}</p>}
      <LinkButton to="/" className="mt-8">
        {t('common.backHome')}
      </LinkButton>
    </div>
  );
}

export function StoreLayout({ error }: { error?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-deep text-cream">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1 pt-[104px] md:pt-[118px]">{error ? <RouteError /> : <Outlet />}</main>
      <Footer />
      <CartDrawer />
      <WhatsAppButton />
    </div>
  );
}
