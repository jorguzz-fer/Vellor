import { ResetPasswordInputSchema } from '@vellor/shared';
import { KeyRound } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BrandLogo } from '@/components/BrandLogo';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { authApi } from '@/lib/api';
import { useZodForm } from '@/lib/forms';
import { usePageMeta } from '@/lib/meta';

/**
 * Destino do link de convite da equipe: a pessoa cria a própria senha de acesso ao painel.
 * Usa o mesmo token da redefinição de senha; o MFA é configurado no primeiro login.
 */
export default function AdminSetPasswordPage() {
  usePageMeta('Definir senha do painel');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const hasToken = ResetPasswordInputSchema.shape.token.safeParse(token).success;
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const form = useZodForm(ResetPasswordInputSchema, { token, password: '' });
  const values = form.values as { password: string };

  const submit = form.handleSubmit(async (data) => {
    if (confirm !== data.password) {
      form.setErrors({ confirm: 'A confirmação não confere com a senha.' });
      return;
    }
    await authApi.resetPassword(data.token, data.password);
    setDone(true);
  });

  let body: ReactNode;
  if (!hasToken) {
    body = (
      <Alert tone="danger">
        Link de convite inválido ou incompleto. Peça a um administrador para gerar um novo convite
        em Equipe.
      </Alert>
    );
  } else if (done) {
    body = (
      <div className="space-y-6" data-testid="set-password-done">
        <Alert tone="success">
          Senha definida. Entre no painel com o seu e-mail e a nova senha; no primeiro acesso você
          ativa a verificação em duas etapas.
        </Alert>
        <LinkButton to="/admin/entrar" full>
          Entrar no painel
        </LinkButton>
      </div>
    );
  } else {
    body = (
      <form onSubmit={submit} noValidate className="space-y-4">
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <Input
          label="Nova senha"
          name="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => form.setField('password', event.target.value)}
          error={form.errors.password}
          hint={t('account.passwordHint')}
          required
          data-testid="set-password"
        />
        <Input
          label="Confirmar senha"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={form.errors.confirm}
          required
          data-testid="set-password-confirm"
        />
        <Button
          type="submit"
          full
          loading={form.submitting}
          icon={<KeyRound className="h-4 w-4" />}
          data-testid="set-password-submit"
        >
          Definir senha
        </Button>
      </form>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-deep px-4 py-12 text-cream">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <div className="card p-6 md:p-8">
          <span className="eyebrow">{t('admin.title')}</span>
          <h1 className="heading mt-2 text-2xl">Definir senha de acesso</h1>
          <p className="mt-2 text-sm text-muted">
            Você foi convidado(a) para administrar a loja. Crie a senha que vai usar no painel.
          </p>
          <div className="mt-6">{body}</div>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/admin/entrar" className="link">
            Já tenho senha, ir para o login
          </Link>
        </p>
      </div>
    </div>
  );
}
