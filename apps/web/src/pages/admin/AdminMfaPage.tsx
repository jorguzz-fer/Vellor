import { useIsFetching, useQuery } from '@tanstack/react-query';
import { TotpCodeSchema } from '@vellor/shared';
import { LogOut, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Alert, ErrorState, PageLoader, Spinner } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { ApiError, authApi } from '@/lib/api';
import { usePageMeta } from '@/lib/meta';
import { queryKeys, useAuth, useAuthMutations } from '@/lib/queries';

interface LocationState {
  from?: string;
}

/** Segunda etapa do acesso ao painel: cadastro (QR code) ou verificação do código TOTP. */
export default function AdminMfaPage() {
  usePageMeta(`${t('auth.mfaTitle')} · ${t('admin.title')}`);
  const auth = useAuth();
  const authFetching = useIsFetching({ queryKey: queryKeys.auth }) > 0;
  const { mfaEnable, mfaVerify, logout } = useAuthMutations();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? '/admin';
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setupMode = auth.authenticated && auth.mfaSetupRequired;
  const setup = useQuery({
    queryKey: ['auth', 'mfa', 'setup'],
    queryFn: authApi.mfaSetup,
    enabled: setupMode,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  // Enquanto a sessão ainda está sendo consultada, useAuth devolve o placeholder anônimo:
  // aguarda para não redirecionar ao login por engano.
  if (!auth.authenticated && authFetching) return <PageLoader />;
  if (!auth.authenticated) return <Navigate to="/admin/entrar" replace state={{ from }} />;
  if (!auth.mfaSetupRequired && !auth.mfaPending) return <Navigate to="/admin" replace />;

  const submitting = mfaEnable.isPending || mfaVerify.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = TotpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Código de 6 dígitos inválido');
      return;
    }
    try {
      if (setupMode) {
        await mfaEnable.mutateAsync(parsed.data);
        navigate('/admin', { replace: true });
      } else {
        await mfaVerify.mutateAsync(parsed.data);
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível validar o código. Tente novamente.');
      setCode('');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-deep px-4 py-12 text-cream">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <div className="card p-6 md:p-8">
          <div className="mb-6 flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-gold/40 bg-gold/10 text-gold">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h1 className="heading text-2xl">{setupMode ? t('auth.mfaSetupTitle') : t('auth.mfaTitle')}</h1>
              <p className="mt-1 text-sm text-muted">{setupMode ? t('auth.mfaSetupText') : t('auth.mfaText')}</p>
            </div>
          </div>

          {setupMode && (
            <div className="mb-6">
              {setup.isPending ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner size={28} />
                </div>
              ) : setup.isError ? (
                <ErrorState message={setup.error instanceof ApiError ? setup.error.message : undefined} onRetry={() => setup.refetch()} />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={setup.data.qrCodeDataUrl}
                    alt="QR code para cadastrar o autenticador"
                    width={192}
                    height={192}
                    className="h-48 w-48 rounded-sm bg-cream p-2"
                  />
                  <div className="w-full rounded-sm border border-line bg-noir/60 p-3 text-center">
                    <p className="label mb-1">{t('auth.mfaSetupSecret')}</p>
                    <code className="break-all font-mono text-sm tracking-[0.15em] text-gold">{setup.data.secretMasked}</code>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={submit} noValidate className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Input
              label={t('auth.mfaCode')}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-xl tracking-[0.5em]"
              disabled={setupMode && !setup.isSuccess}
              data-testid="mfa-code"
            />
            <Button type="submit" full loading={submitting} disabled={setupMode && !setup.isSuccess} data-testid="mfa-submit">
              {setupMode ? t('auth.mfaEnable') : t('auth.mfaVerify')}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
            <span className="truncate">{auth.user?.email}</span>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="inline-flex items-center gap-1.5 uppercase tracking-[0.2em] text-ivory/70 transition-colors hover:text-danger disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" /> {t('admin.logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
