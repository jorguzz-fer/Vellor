import { LoginInputSchema } from '@vellor/shared';
import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { useZodForm } from '@/lib/forms';
import { usePageMeta } from '@/lib/meta';
import { useAuth, useAuthMutations } from '@/lib/queries';

interface LocationState {
  from?: string;
}

/** Página de acesso ao painel: independente do layout do admin (fundo escuro, card centralizado). */
export default function AdminLoginPage() {
  usePageMeta(`${t('admin.login')} · ${t('admin.title')}`);
  const auth = useAuth();
  const { login, logout } = useAuthMutations();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from;
  const [accessError, setAccessError] = useState<string | null>(null);
  const form = useZodForm(LoginInputSchema, { email: '', password: '' });

  const mfaIncomplete = auth.mfaSetupRequired || auth.mfaPending;
  if (auth.authenticated && auth.isAdmin) {
    // Sessão de admin já existente: segue direto para o painel (ou para concluir o MFA).
    return mfaIncomplete ? (
      <Navigate to="/admin/mfa" replace state={{ from }} />
    ) : (
      <Navigate to={from ?? '/admin'} replace />
    );
  }

  const value = (name: string) => (form.values[name] as string | undefined) ?? '';

  const submit = form.handleSubmit(async (data) => {
    setAccessError(null);
    const status = await login.mutateAsync(data);
    if (status.mfaSetupRequired || status.mfaPending) {
      navigate('/admin/mfa', { replace: true, state: { from } });
      return;
    }
    if (status.user?.role === 'admin') {
      navigate(from ?? '/admin', { replace: true });
      return;
    }
    // Conta de cliente: encerra a sessão criada e avisa.
    setAccessError('Esta conta não tem acesso ao painel. Use uma conta de administrador.');
    await logout.mutateAsync();
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-deep px-4 py-12 text-cream">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <div className="card p-6 md:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-gold/40 bg-gold/10 text-gold">
              <LockKeyhole className="h-4 w-4" />
            </span>
            <div>
              <h1 className="heading text-2xl">{t('admin.login')}</h1>
              <p className="mt-1 text-sm text-muted">{t('admin.loginText')}</p>
            </div>
          </div>

          <form onSubmit={submit} noValidate className="space-y-4">
            {form.formError && <Alert tone="danger">{form.formError}</Alert>}
            {accessError && <Alert tone="danger">{accessError}</Alert>}
            <Input
              label={t('account.email')}
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              value={value('email')}
              onChange={(e) => form.setField('email', e.target.value)}
              error={form.errors.email}
              data-testid="admin-login-email"
            />
            <Input
              label={t('account.password')}
              name="password"
              type="password"
              autoComplete="current-password"
              value={value('password')}
              onChange={(e) => form.setField('password', e.target.value)}
              error={form.errors.password}
              data-testid="admin-login-password"
            />
            <Button
              type="submit"
              full
              loading={form.submitting || logout.isPending}
              data-testid="admin-login-submit"
            >
              {t('account.login')}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center">
          <Link
            to="/"
            className="text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-gold"
          >
            {t('common.backHome')}
          </Link>
        </p>
      </div>
    </div>
  );
}
