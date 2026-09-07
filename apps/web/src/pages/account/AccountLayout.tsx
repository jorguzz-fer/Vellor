import { useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, LogOut, MapPin, Package, UserRound } from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Button, LinkButton } from '@/components/ui/button';
import { PageLoader, useToast } from '@/components/ui/feedback';
import { t } from '@/i18n/pt-BR';
import { queryKeys, useAuth, useAuthMutations } from '@/lib/queries';

const TABS = [
  { to: '/conta/pedidos', label: t('account.orders'), icon: Package, matchesIndex: true },
  { to: '/conta/enderecos', label: t('account.addresses'), icon: MapPin, matchesIndex: false },
  { to: '/conta/dados', label: t('account.profile'), icon: UserRound, matchesIndex: false },
];

function tabClass(active: boolean): string {
  return `-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors ${
    active ? 'border-gold text-gold' : 'border-transparent text-ivory/70 hover:text-ivory'
  }`;
}

export default function AccountLayout() {
  const auth = useAuth();
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuthMutations();
  const { toast } = useToast();

  // `useAuth` usa placeholderData, então `isLoading` fica falso já na primeira busca da sessão;
  // o estado bruto da query indica se ela ainda não foi resolvida (evita redirecionar cedo demais).
  const resolving = auth.isLoading || client.getQueryState(queryKeys.auth)?.status === 'pending';
  // Enquanto o logout acontece, não redirecionamos para o login: o botão leva para a home.
  const leaving = logout.isPending || logout.isSuccess;

  if (resolving) return <PageLoader />;
  if (!auth.authenticated || !auth.user) {
    return leaving ? (
      <PageLoader />
    ) : (
      <Navigate to="/conta/entrar" state={{ from: location.pathname }} replace />
    );
  }
  if (auth.isAdmin && (auth.mfaSetupRequired || auth.mfaPending))
    return <Navigate to="/admin/mfa" replace />;

  const user = auth.user;
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      navigate('/');
    } catch (error) {
      toast(error instanceof Error ? error.message : t('common.error'), 'danger');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="eyebrow">{t('account.title')}</span>
          <h1 className="heading mt-2 text-3xl" data-testid="account-greeting">
            Olá, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {auth.isAdmin && (
            <LinkButton
              to="/admin"
              variant="secondary"
              size="sm"
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              {t('nav.admin')}
            </LinkButton>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<LogOut className="h-4 w-4" />}
            loading={leaving}
            onClick={handleLogout}
            data-testid="account-logout"
          >
            {t('account.logout')}
          </Button>
        </div>
      </header>

      <nav
        aria-label={t('account.title')}
        className="scrollbar-none mt-8 flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const indexActive = tab.matchesIndex && location.pathname === '/conta';
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => tabClass(isActive || indexActive)}
              aria-current={indexActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  );
}
