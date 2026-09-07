import { useQueryClient } from '@tanstack/react-query';
import {
  type AuthStatus,
  ChangePasswordInputSchema,
  type Me,
  type UpdateProfileInput,
  UpdateProfileInputSchema,
} from '@vellor/shared';
import { KeyRound, Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, useToast } from '@/components/ui/feedback';
import { Checkbox, Input } from '@/components/ui/form';
import { t } from '@/i18n/pt-BR';
import { authApi } from '@/lib/api';
import { maskCpfInput, maskPhoneInput } from '@/lib/format';
import { useZodForm } from '@/lib/forms';
import { usePageMeta } from '@/lib/meta';
import { queryKeys, useAuth } from '@/lib/queries';

export default function ProfilePage() {
  usePageMeta(t('account.profile'));
  const { user } = useAuth();
  if (!user) return null; // o AccountLayout garante a sessão; aqui só satisfaz o tipo

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <ProfileForm user={user} />
      <PasswordForm />
    </div>
  );
}

// ---------- Dados pessoais ----------

type ProfileValues = {
  name: string;
  /** Vazio → undefined: o schema só aceita telefone válido ou ausente. */
  phone?: string;
  /** Só é enviado quando preenchido; o CPF já cadastrado aparece mascarado na dica. */
  cpf?: string;
  newsletterOptIn: boolean;
};

function ProfileForm({ user }: { user: Me }) {
  const client = useQueryClient();
  const { toast } = useToast();
  const form = useZodForm(UpdateProfileInputSchema, {
    name: user.name,
    phone: user.phone ? maskPhoneInput(user.phone) : undefined,
    cpf: undefined,
    newsletterOptIn: user.newsletterOptIn,
  });
  const values = form.values as ProfileValues;

  const submit = form.handleSubmit(async (data) => {
    // Envia apenas o que mudou (ou foi preenchido), como o PATCH espera.
    const payload: UpdateProfileInput = {};
    if (data.name && data.name !== user.name) payload.name = data.name;
    if (data.phone && data.phone !== user.phone) payload.phone = data.phone;
    if (data.cpf) payload.cpf = data.cpf;
    if (data.newsletterOptIn !== undefined && data.newsletterOptIn !== user.newsletterOptIn)
      payload.newsletterOptIn = data.newsletterOptIn;
    if (Object.keys(payload).length === 0) {
      toast('Nenhuma alteração para salvar.', 'info');
      return;
    }
    const me = await authApi.updateProfile(payload);
    client.setQueryData<AuthStatus>(queryKeys.auth, (prev) =>
      prev ? { ...prev, user: me } : prev,
    );
    await client.invalidateQueries({ queryKey: queryKeys.auth });
    form.setField('cpf', undefined);
    toast(t('account.profileSaved'), 'success');
  });

  const cpfHint = user.cpfMasked
    ? `CPF cadastrado: ${user.cpfMasked}. Preencha apenas para alterar.`
    : t('checkout.cpfHint');

  return (
    <section aria-labelledby="profile-title" className="card p-5 md:p-6">
      <h2 id="profile-title" className="heading text-xl">
        {t('account.profile')}
      </h2>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <Input
          label={t('account.name')}
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={(e) => form.setField('name', e.target.value)}
          error={form.errors.name}
          required
          data-testid="profile-name"
        />
        <Input
          label={t('account.email')}
          name="email"
          type="email"
          value={user.email}
          readOnly
          disabled
          hint="Para alterar o e-mail, fale com o nosso atendimento."
        />
        <div className="grid gap-4 sm:grid-cols-2">
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
            data-testid="profile-phone"
          />
          <Input
            label={t('account.cpf')}
            name="cpf"
            inputMode="numeric"
            autoComplete="off"
            placeholder={user.cpfMasked ?? '000.000.000-00'}
            value={values.cpf ?? ''}
            onChange={(e) => form.setField('cpf', maskCpfInput(e.target.value) || undefined)}
            error={form.errors.cpf}
            hint={cpfHint}
            data-testid="profile-cpf"
          />
        </div>
        <Checkbox
          name="newsletterOptIn"
          checked={values.newsletterOptIn}
          onChange={(e) => form.setField('newsletterOptIn', e.target.checked)}
          label={t('account.newsletter')}
          data-testid="profile-newsletter"
        />
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            loading={form.submitting}
            icon={<Save className="h-4 w-4" />}
            data-testid="profile-submit"
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ---------- Senha ----------

function PasswordForm() {
  const { toast } = useToast();
  const [confirm, setConfirm] = useState('');
  const form = useZodForm(ChangePasswordInputSchema, { currentPassword: '', newPassword: '' });
  const values = form.values as { currentPassword: string; newPassword: string };

  const submit = form.handleSubmit(async (data) => {
    if (confirm !== data.newPassword) {
      form.setErrors({ confirm: 'A confirmação não confere com a nova senha.' });
      return;
    }
    await authApi.changePassword(data);
    form.reset();
    setConfirm('');
    toast(t('account.passwordChanged'), 'success');
  });

  return (
    <section aria-labelledby="password-title" className="card p-5 md:p-6">
      <h2 id="password-title" className="heading text-xl">
        {t('account.changePassword')}
      </h2>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <Input
          label={t('account.currentPassword')}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={(e) => form.setField('currentPassword', e.target.value)}
          error={form.errors.currentPassword}
          required
          data-testid="password-current"
        />
        <Input
          label={t('account.newPassword')}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(e) => form.setField('newPassword', e.target.value)}
          error={form.errors.newPassword}
          hint={t('account.passwordHint')}
          required
          data-testid="password-new"
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
          data-testid="password-confirm"
        />
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="secondary"
            loading={form.submitting}
            icon={<KeyRound className="h-4 w-4" />}
            data-testid="password-submit"
          >
            {t('account.changePassword')}
          </Button>
        </div>
      </form>
    </section>
  );
}
