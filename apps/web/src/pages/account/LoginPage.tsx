import { LoginInputSchema } from '@vellor/shared';
import { LogIn } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { useZodForm } from '@/lib/forms';
import { usePageMeta } from '@/lib/meta';
import { useAuth, useAuthMutations } from '@/lib/queries';

/** Só aceita caminhos internos como destino após o login (evita redirecionamento aberto via ?next=). */
function internalPath(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

export default function LoginPage() {
  usePageMeta(t('account.login'));
  const auth = useAuth();
  const { login } = useAuthMutations();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state ?? null) as { from?: string } | null;
  const destination =
    internalPath(searchParams.get('next')) ?? internalPath(state?.from) ?? '/conta';
  const form = useZodForm(LoginInputSchema, { email: '', password: '' });
  const values = form.values as { email: string; password: string };

  if (auth.authenticated) {
    const needsMfa = auth.isAdmin && (auth.mfaSetupRequired || auth.mfaPending);
    return <Navigate to={needsMfa ? '/admin/mfa' : destination} replace />;
  }

  const submit = form.handleSubmit(async (data) => {
    const status = await login.mutateAsync(data);
    const needsMfa =
      status.user?.role === 'admin' && (status.mfaSetupRequired || status.mfaPending);
    navigate(needsMfa ? '/admin/mfa' : destination, { replace: true });
  });

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 md:py-16">
      <div className="card p-6 md:p-8">
        <span className="eyebrow">{t('account.title')}</span>
        <h1 className="heading mt-2 text-2xl">{t('account.login')}</h1>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          {form.formError && <Alert tone="danger">{form.formError}</Alert>}
          <Input
            label={t('account.email')}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            onChange={(e) => form.setField('email', e.target.value)}
            error={form.errors.email}
            required
            data-testid="login-email"
          />
          <Input
            label={t('account.password')}
            name="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => form.setField('password', e.target.value)}
            error={form.errors.password}
            required
            data-testid="login-password"
          />
          <div className="flex justify-end">
            <Link to="/conta/recuperar-senha" className="link text-xs">
              {t('account.forgot')}
            </Link>
          </div>
          <Button
            type="submit"
            full
            loading={form.submitting}
            icon={<LogIn className="h-4 w-4" />}
            data-testid="login-submit"
          >
            {t('account.login')}
          </Button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        {t('account.noAccount')}{' '}
        <Link
          to={{ pathname: '/conta/cadastro', search: location.search }}
          state={state}
          className="link"
        >
          {t('account.register')}
        </Link>
      </p>
    </div>
  );
}
