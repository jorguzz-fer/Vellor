import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Address,
  BRAZIL_STATES,
  type SaveAddressInput,
  SaveAddressInputSchema,
} from '@vellor/shared';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  PageLoader,
  useToast,
} from '@/components/ui/feedback';
import { Checkbox, Input, Select } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { t } from '@/i18n/pt-BR';
import { ApiError, accountApi, checkoutApi } from '@/lib/api';
import { formatCEP, maskCepInput } from '@/lib/format';
import { useZodForm } from '@/lib/forms';
import { usePageMeta } from '@/lib/meta';

const ADDRESSES_KEY = ['account', 'addresses'] as const;
const STATE_OPTIONS = BRAZIL_STATES.map((uf) => ({ value: uf, label: uf }));

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : t('common.error');
}

/** Converte um endereço salvo no corpo aceito por PUT /account/addresses/:id. */
function toInput(address: Address): SaveAddressInput {
  return {
    label: address.label,
    recipientName: address.recipientName,
    cep: address.cep,
    street: address.street,
    number: address.number,
    complement: address.complement ?? null,
    district: address.district,
    city: address.city,
    state: address.state,
    reference: address.reference ?? null,
    isDefault: address.isDefault,
  };
}

function addressTitle(address: Address): string {
  return address.label?.trim() || `${address.street}, ${address.number}`;
}

export default function AddressesPage() {
  usePageMeta(t('account.addresses'));
  const client = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({ queryKey: ADDRESSES_KEY, queryFn: accountApi.addresses });
  const [editing, setEditing] = useState<{ address: Address | null } | null>(null);
  const [removing, setRemoving] = useState<Address | null>(null);
  const invalidate = () => client.invalidateQueries({ queryKey: ADDRESSES_KEY });

  const remove = useMutation({
    mutationFn: (id: string) => accountApi.deleteAddress(id),
    onSuccess: async () => {
      await invalidate();
      setRemoving(null);
      toast('Endereço removido.', 'success');
    },
    onError: (error) => toast(errorMessage(error), 'danger'),
  });

  const setDefault = useMutation({
    mutationFn: (address: Address) =>
      accountApi.updateAddress(address.id, { ...toInput(address), isDefault: true }),
    onSuccess: async () => {
      await invalidate();
      toast('Endereço principal atualizado.', 'success');
    },
    onError: (error) => toast(errorMessage(error), 'danger'),
  });

  const openCreate = () => setEditing({ address: null });
  const closeEditor = () => setEditing(null);
  const closeRemove = () => {
    if (!remove.isPending) setRemoving(null);
  };

  return (
    <section aria-labelledby="addresses-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="addresses-title" className="heading text-xl">
          {t('account.addresses')}
        </h2>
        <Button
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={openCreate}
          data-testid="address-add"
        >
          {t('account.addAddress')}
        </Button>
      </div>

      <div className="mt-6">
        {query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-8 w-8" />}
            title={t('account.noAddresses')}
            text="Salve um endereço para preencher a entrega automaticamente nas próximas compras."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                {t('account.addAddress')}
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2" data-testid="address-list">
            {query.data.map((address) => (
              <li key={address.id} className="card flex flex-col p-5" data-testid="address-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-cream">
                      {addressTitle(address)}
                    </h3>
                    {address.recipientName && (
                      <p className="mt-0.5 text-xs text-muted">{address.recipientName}</p>
                    )}
                  </div>
                  {address.isDefault && <Badge tone="gold">{t('account.defaultAddress')}</Badge>}
                </div>
                <address className="mt-3 text-sm not-italic leading-relaxed text-ivory/85">
                  {address.street}, {address.number}
                  {address.complement ? ` – ${address.complement}` : ''}
                  <br />
                  {address.district} · {address.city}/{address.state}
                  <br />
                  CEP {formatCEP(address.cep)}
                </address>
                {address.reference && (
                  <p className="mt-1 text-xs text-muted">Ref.: {address.reference}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => setEditing({ address })}
                    data-testid="address-edit"
                  >
                    {t('common.edit')}
                  </Button>
                  {!address.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Star className="h-3.5 w-3.5" />}
                      loading={setDefault.isPending && setDefault.variables?.id === address.id}
                      disabled={setDefault.isPending}
                      onClick={() => setDefault.mutate(address)}
                      data-testid="address-set-default"
                    >
                      {t('account.setDefault')}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setRemoving(address)}
                    data-testid="address-remove"
                  >
                    {t('common.remove')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={editing !== null}
        onClose={closeEditor}
        title={editing?.address ? 'Editar endereço' : t('account.addAddress')}
        size="lg"
      >
        {editing && (
          <AddressForm address={editing.address} onSaved={closeEditor} onCancel={closeEditor} />
        )}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        onClose={closeRemove}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id);
        }}
        title="Remover endereço"
        text={
          removing ? (
            <>
              Remover o endereço <strong className="text-cream">{addressTitle(removing)}</strong>?
              Esta ação não pode ser desfeita.
            </>
          ) : null
        }
        confirmLabel={t('common.remove')}
        danger
        loading={remove.isPending}
      />
    </section>
  );
}

// ---------- Formulário de endereço ----------

type AddressFormValues = {
  label: string;
  /** Vazio → undefined: o schema exige 3+ caracteres quando informado. */
  recipientName?: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  reference: string;
  isDefault: boolean;
};

function AddressForm({
  address,
  onSaved,
  onCancel,
}: {
  address: Address | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const client = useQueryClient();
  const { toast } = useToast();
  const form = useZodForm(SaveAddressInputSchema, {
    label: address?.label ?? '',
    recipientName: address?.recipientName || undefined,
    cep: address ? formatCEP(address.cep) : '',
    street: address?.street ?? '',
    number: address?.number ?? '',
    complement: address?.complement ?? '',
    district: address?.district ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    reference: address?.reference ?? '',
    isDefault: address?.isDefault ?? false,
  });
  const values = form.values as AddressFormValues;
  const lastLookup = useRef(address?.cep ?? '');
  const [cepHint, setCepHint] = useState<string | null>(null);

  const lookupCep = async (digits: string) => {
    setCepHint('Consultando CEP…');
    try {
      const result = await checkoutApi.cep(digits);
      form.setValues((prev) => ({
        ...prev,
        street: result.street || prev.street,
        district: result.district || prev.district,
        city: result.city || prev.city,
        state: result.state || prev.state,
      }));
      form.setErrors((prev) => ({
        ...prev,
        street: undefined,
        district: undefined,
        city: undefined,
        state: undefined,
      }));
      setCepHint(
        result.partial ? 'Não foi possível consultar o endereço completo. Confira os dados.' : null,
      );
    } catch (error) {
      setCepHint(
        error instanceof ApiError && error.status === 404
          ? 'CEP não encontrado. Preencha o endereço manualmente.'
          : 'Não foi possível consultar o CEP. Preencha o endereço manualmente.',
      );
    }
  };

  const onCepChange = (raw: string) => {
    const masked = maskCepInput(raw);
    form.setField('cep', masked);
    const digits = masked.replace(/\D/g, '');
    if (digits.length === 8 && digits !== lastLookup.current) {
      lastLookup.current = digits;
      void lookupCep(digits);
    }
  };

  const submit = form.handleSubmit(async (data) => {
    const input: SaveAddressInput = {
      ...data,
      label: data.label || null,
      recipientName: data.recipientName || undefined,
      complement: data.complement || null,
      reference: data.reference || null,
    };
    if (address) await accountApi.updateAddress(address.id, input);
    else await accountApi.createAddress(input);
    await client.invalidateQueries({ queryKey: ADDRESSES_KEY });
    toast(address ? 'Endereço atualizado.' : 'Endereço salvo.', 'success');
    onSaved();
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="address-form">
      {form.formError && <Alert tone="danger">{form.formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('account.label')}
          name="label"
          placeholder="Casa, Trabalho…"
          maxLength={40}
          value={values.label}
          onChange={(e) => form.setField('label', e.target.value)}
          error={form.errors.label}
          data-testid="address-label"
        />
        <Input
          label={t('checkout.recipient')}
          name="recipientName"
          autoComplete="name"
          value={values.recipientName ?? ''}
          onChange={(e) => form.setField('recipientName', e.target.value || undefined)}
          error={form.errors.recipientName}
          data-testid="address-recipient"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,160px)_1fr]">
        <Input
          label={t('checkout.cep')}
          name="cep"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          value={values.cep}
          onChange={(e) => onCepChange(e.target.value)}
          error={form.errors.cep}
          hint={cepHint ?? undefined}
          required
          data-testid="address-cep"
        />
        <Input
          label={t('checkout.street')}
          name="street"
          autoComplete="address-line1"
          value={values.street}
          onChange={(e) => form.setField('street', e.target.value)}
          error={form.errors.street}
          required
          data-testid="address-street"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('checkout.number')}
          name="number"
          value={values.number}
          onChange={(e) => form.setField('number', e.target.value)}
          error={form.errors.number}
          required
          data-testid="address-number"
        />
        <Input
          label={t('checkout.complement')}
          name="complement"
          autoComplete="address-line2"
          value={values.complement}
          onChange={(e) => form.setField('complement', e.target.value)}
          error={form.errors.complement}
          data-testid="address-complement"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_minmax(0,110px)]">
        <Input
          label={t('checkout.district')}
          name="district"
          value={values.district}
          onChange={(e) => form.setField('district', e.target.value)}
          error={form.errors.district}
          required
          data-testid="address-district"
        />
        <Input
          label={t('checkout.city')}
          name="city"
          autoComplete="address-level2"
          value={values.city}
          onChange={(e) => form.setField('city', e.target.value)}
          error={form.errors.city}
          required
          data-testid="address-city"
        />
        <Select
          label={t('checkout.state')}
          name="state"
          autoComplete="address-level1"
          options={STATE_OPTIONS}
          placeholder="UF"
          value={values.state}
          onChange={(e) => form.setField('state', e.target.value)}
          error={form.errors.state}
          required
          data-testid="address-state"
        />
      </div>
      <Input
        label={t('checkout.reference')}
        name="reference"
        value={values.reference}
        onChange={(e) => form.setField('reference', e.target.value)}
        error={form.errors.reference}
        data-testid="address-reference"
      />
      <Checkbox
        name="isDefault"
        checked={values.isDefault}
        onChange={(e) => form.setField('isDefault', e.target.checked)}
        label="Usar como endereço principal"
        data-testid="address-default"
      />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={form.submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={form.submitting} data-testid="address-submit">
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
