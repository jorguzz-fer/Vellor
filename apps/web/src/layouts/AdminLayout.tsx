import {
  BarChart3,
  ExternalLink,
  FileClock,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  TicketPercent,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { Suspense, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { BrandLogo } from '@/components/BrandLogo';
import { PageLoader } from '@/components/ui/feedback';
import { t } from '@/i18n/pt-BR';
import { useAuth, useAuthMutations } from '@/lib/queries';

const NAV = [
  { to: '/admin', label: t('admin.dashboard'), icon: BarChart3, end: true },
  { to: '/admin/pedidos', label: t('admin.orders'), icon: ShoppingCart },
  { to: '/admin/produtos', label: t('admin.products'), icon: Package },
  { to: '/admin/categorias', label: t('admin.categories'), icon: LayoutGrid },
  { to: '/admin/cupons', label: t('admin.coupons'), icon: TicketPercent },
  { to: '/admin/clientes', label: t('admin.customers'), icon: Users },
  { to: '/admin/atendimento', label: t('admin.contacts'), icon: MessageSquare },
  { to: '/admin/newsletter', label: t('admin.newsletter'), icon: Mail },
  { to: '/admin/configuracoes', label: t('admin.settings'), icon: Settings },
  { to: '/admin/equipe', label: t('admin.team'), icon: UserCog },
  { to: '/admin/auditoria', label: t('admin.audit'), icon: FileClock },
  { to: '/admin/categorias', label: '', icon: Tags, hidden: true },
].filter((n) => !n.hidden);

export function AdminLayout() {
  const auth = useAuth();
  const { logout } = useAuthMutations();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (auth.isLoading) return <PageLoader />;
  if (!auth.authenticated)
    return <Navigate to="/admin/entrar" replace state={{ from: location.pathname }} />;
  if (!auth.isAdmin) return <Navigate to="/" replace />;
  if (auth.mfaSetupRequired || auth.mfaPending)
    return <Navigate to="/admin/mfa" replace state={{ from: location.pathname }} />;

  return (
    <div className="flex min-h-screen bg-deep text-cream">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-noir transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <BrandLogo size="sm" />
          <button
            type="button"
            className="p-1 text-ivory/60 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="eyebrow mb-3 px-2">{t('admin.title')}</p>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `mb-0.5 flex items-center gap-3 rounded-sm px-3 py-2.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${isActive ? 'bg-spruce text-gold' : 'text-ivory/70 hover:bg-spruce/60 hover:text-ivory'}`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-sm px-3 py-2 text-xs uppercase tracking-[0.12em] text-ivory/70 hover:text-gold"
          >
            <ExternalLink className="h-4 w-4" /> {t('admin.viewStore')}
          </a>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-xs uppercase tracking-[0.12em] text-ivory/70 hover:text-danger"
          >
            <LogOut className="h-4 w-4" /> {t('admin.logout')}
          </button>
        </div>
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-noir/70 lg:hidden"
          onClick={() => setOpen(false)}
          role="presentation"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-dark px-4 py-3 lg:px-8">
          <button
            type="button"
            className="p-1 text-ivory/70 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-xs text-muted">
            {auth.user?.name} · <span className="text-gold">admin</span>
          </span>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
