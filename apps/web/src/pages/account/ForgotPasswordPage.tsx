import { ForgotPasswordInputSchema } from '@vellor/shared';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { authApi } from '@/lib/api';
import { useZodForm } from '@/lib/forms';
import { usePageMeta } from '@/lib/meta';

export default function ForgotPasswordPage() {
  usePageMeta(t('account.forgotTitle'));
  const [done, setDone] = useState(false);
  const form = useZodForm(ForgotPasswordInputSchema, { email: '' });
  const values = form.values as { email: string };

  const submit = form.handleSubmit(async (data) => {
    await authApi.forgotPassword(data.email);
    setDone(true);
  });

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 md:py-16">
      <div className="card p-6 md:p-8">
        <span className="eyebrow">{t('account.title')}</span>
        <h1 className="heading mt-2 text-2xl">{t('account.forgotTitle')}</h1>
        {done ? (
          <div className="mt-6 space-y-6" data-testid="forgot-done">
            <Alert tone="success">{t('account.forgotDone')}</Alert>
            <LinkButton to="/conta/entrar" variant="secondary" full>
              {t('account.login')}
            </LinkButton>
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">{t('account.forgotText')}</p>
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
                data-testid="forgot-email"
              />
              <Button
                type="submit"
                full
                loading={form.submitting}
                icon={<Send className="h-4 w-4" />}
                data-testid="forgot-submit"
              >
                Enviar link de redefinição
              </Button>
            </form>
          </>
        )}
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/conta/entrar" className="link">
          {t('common.back')} para o login
        </Link>
      </p>
    </div>
  );
}
