import { RegisterInputSchema } from '@vellor/shared';
import { UserPlus } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Checkbox, Input } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { maskPhoneInput } from '@/lib/format';
import { useZodForm } from '@/lib/forms';
import { usePageMeta } from '@/lib/meta';
import { useAuth, useAuthMutations } from '@/lib/queries';

/** Só aceita caminhos internos como destino após o cadastro (evita redirecionamento aberto via ?next=). */
function internalPath(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

type RegisterValues = {
  name: string;
  email: string;
  password: string;
  /** Vazio → undefined, porque o schema só aceita telefone válido ou ausente. */
  phone?: string;
  acceptTerms: boolean;
  newsletterOptIn: boolean;
};

export default function RegisterPage() {
  usePageMeta(t('account.register'));
  const auth = useAuth();
  const { register } = useAuthMutations();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state ?? null) as { from?: string } | null;
  const destination =
    internalPath(searchParams.get('next')) ?? internalPath(state?.from) ?? '/conta';
  const form = useZodForm(RegisterInputSchema, {
    name: '',
    email: '',
    password: '',
    phone: undefined,
    acceptTerms: false,
    newsletterOptIn: false,
  });
  const values = form.values as RegisterValues;

  if (auth.authenticated) {
    const needsMfa = auth.isAdmin && (auth.mfaSetupRequired || auth.mfaPending);
    return <Navigate to={needsMfa ? '/admin/mfa' : destination} replace />;
  }

  const submit = form.handleSubmit(async (data) => {
    await register.mutateAsync({ ...data, phone: data.phone || undefined });
    navigate(destination, { replace: true });
  });

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 md:py-16">
      <div className="card p-6 md:p-8">
        <span className="eyebrow">{t('account.title')}</span>
        <h1 className="heading mt-2 text-2xl">{t('account.register')}</h1>
        <p className="mt-3 text-sm text-muted">
          Acompanhe seus pedidos, salve endereços e finalize compras mais rápido.
        </p>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          {form.formError && <Alert tone="danger">{form.formError}</Alert>}
          <Input
            label={t('account.name')}
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={(e) => form.setField('name', e.target.value)}
            error={form.errors.name}
            required
            data-testid="register-name"
          />
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
            data-testid="register-email"
          />
          <Input
            label={t('account.password')}
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => form.setField('password', e.target.value)}
            error={form.errors.password}
            hint={t('account.passwordHint')}
            required
            data-testid="register-password"
          />
          <Input
            label={t('account.phone')}
            name="phone"
            type="tel"
            autoComplete="tel-national"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            value={values.phone ?? ''}
            onChange={(e) => form.setField('phone', maskPhoneInput(e.target.value) || undefined)}
            error={form.errors.phone}
            hint="Opcional. Usado apenas para avisos sobre seus pedidos."
            data-testid="register-phone"
          />
          <Checkbox
            name="acceptTerms"
            checked={values.acceptTerms}
            onChange={(e) => form.setField('acceptTerms', e.target.checked)}
            error={form.errors.acceptTerms}
            data-testid="register-terms"
            label={
              <>
                Li e aceito os{' '}
                <Link to="/termos" target="_blank" rel="noreferrer" className="link">
                  {t('legal.terms')}
                </Link>{' '}
                e a{' '}
                <Link to="/privacidade" target="_blank" rel="noreferrer" className="link">
                  {t('legal.privacy')}
                </Link>
                .
              </>
            }
          />
          <Checkbox
            name="newsletterOptIn"
            checked={values.newsletterOptIn}
            onChange={(e) => form.setField('newsletterOptIn', e.target.checked)}
            label={t('account.newsletter')}
            data-testid="register-newsletter"
          />
          <Button
            type="submit"
            full
            loading={form.submitting}
            icon={<UserPlus className="h-4 w-4" />}
            data-testid="register-submit"
          >
            {t('account.register')}
          </Button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        {t('account.hasAccount')}{' '}
        <Link
          to={{ pathname: '/conta/entrar', search: location.search }}
          state={state}
          className="link"
        >
          {t('account.login')}
        </Link>
      </p>
    </div>
  );
}
