import { ResetPasswordInputSchema } from '@vellor/shared';
import { KeyRound } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { authApi } from '@/lib/api';
import { useZodForm } from '@/lib/forms';
import { usePageMeta } from '@/lib/meta';

export default function ResetPasswordPage() {
  usePageMeta(t('account.resetTitle'));
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const hasToken = ResetPasswordInputSchema.shape.token.safeParse(token).success;
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const form = useZodForm(ResetPasswordInputSchema, { token, password: '' });
  const values = form.values as { password: string };

  const submit = form.handleSubmit(async (data) => {
    if (confirm !== data.password) {
      form.setErrors({ confirm: 'A confirmação não confere com a nova senha.' });
      return;
    }
    await authApi.resetPassword(data.token, data.password);
    setDone(true);
  });

  let body: ReactNode;
  if (!hasToken) {
    body = (
      <div className="mt-6 space-y-6">
        <Alert tone="danger">
          Link de redefinição inválido ou incompleto. Solicite um novo link para continuar.
        </Alert>
        <LinkButton to="/conta/recuperar-senha" variant="secondary" full>
          {t('account.forgotTitle')}
        </LinkButton>
      </div>
    );
  } else if (done) {
    body = (
      <div className="mt-6 space-y-6" data-testid="reset-done">
        <Alert tone="success">{t('account.resetDone')}</Alert>
        <LinkButton to="/conta/entrar" full>
          {t('account.login')}
        </LinkButton>
      </div>
    );
  } else {
    body = (
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <Input
          label={t('account.newPassword')}
          name="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => form.setField('password', e.target.value)}
          error={form.errors.password}
          hint={t('account.passwordHint')}
          required
          data-testid="reset-password"
        />
        <Input
          label="Confirmar nova senha"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={form.errors.confirm}
          required
          data-testid="reset-confirm"
        />
        <Button
          type="submit"
          full
          loading={form.submitting}
          icon={<KeyRound className="h-4 w-4" />}
          data-testid="reset-submit"
        >
          Redefinir senha
        </Button>
      </form>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 md:py-16">
      <div className="card p-6 md:p-8">
        <span className="eyebrow">{t('account.title')}</span>
        <h1 className="heading mt-2 text-2xl">{t('account.resetTitle')}</h1>
        {body}
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/conta/entrar" className="link">
          {t('common.back')} para o login
        </Link>
      </p>
    </div>
  );
}
