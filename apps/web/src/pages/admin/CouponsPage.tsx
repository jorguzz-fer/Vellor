import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Coupon,
  type CouponInput,
  CouponInputSchema,
  type CouponType,
  formatBRL,
} from '@vellor/shared';
import { Pencil, Plus, Power, TicketPercent } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  PageLoader,
  useToast,
} from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { adminApi, ApiError } from '@/lib/api';
import { useZodForm } from '@/lib/forms';
import { centsToInput, formatShortDate, inputToCents } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

const TYPE_OPTIONS: Array<{ value: CouponType; label: string }> = [
  { value: 'percent', label: 'Percentual (%)' },
  { value: 'fixed', label: 'Valor fixo (R$)' },
];

/** Traduz as mensagens padrão (em inglês) do Zod; mensagens customizadas dos schemas já vêm em pt-BR. */
function translateZodMessage(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const rules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [
      /^Too small: expected string to have >=(\d+) character/,
      (m) => (m[1] === '1' ? 'Campo obrigatório' : `Mínimo de ${m[1]} caracteres`),
    ],
    [/^Too big: expected string to have <=(\d+) character/, (m) => `Máximo de ${m[1]} caracteres`],
    [/^Too small: expected number to be >=?(-?[\d.]+)/, (m) => `Valor mínimo: ${m[1]}`],
    [/^Too big: expected number to be <=?(-?[\d.]+)/, (m) => `Valor máximo: ${m[1]}`],
    [/^Invalid input: expected int/, () => 'Use um número inteiro'],
    [/^Invalid input: expected number/, () => 'Informe um número válido'],
    [/^Invalid input: expected string/, () => 'Campo obrigatório'],
    [/^Invalid ISO datetime/, () => 'Data inválida'],
    [/^Invalid string: must match pattern/, () => 'Use apenas letras, números, hífen e sublinhado'],
    [/^Invalid option/, () => 'Opção inválida'],
    [/^Invalid/, () => 'Valor inválido'],
    [/^Too small/, () => 'Valor muito baixo'],
    [/^Too big/, () => 'Valor muito alto'],
  ];
  for (const [pattern, build] of rules) {
    const match = message.match(pattern);
    if (match) return build(match);
  }
  return message;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

/** ISO (UTC) -> valor de <input type="datetime-local"> no fuso do navegador. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function couponValueLabel(coupon: Coupon): string {
  return coupon.type === 'percent' ? `${coupon.value}%` : formatBRL(coupon.value);
}

function validityLabel(coupon: Coupon): string {
  if (!coupon.startsAt && !coupon.endsAt) return 'Sem prazo';
  const start = coupon.startsAt ? formatShortDate(coupon.startsAt) : 'imediato';
  const end = coupon.endsAt ? formatShortDate(coupon.endsAt) : 'sem fim';
  return `${start} – ${end}`;
}

function couponStatus(
  coupon: Coupon,
  now: number,
): { label: string; tone: 'success' | 'muted' | 'warning' | 'info' } {
  if (!coupon.isActive) return { label: 'Inativo', tone: 'muted' };
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now)
    return { label: 'Expirado', tone: 'warning' };
  if (coupon.maxUses !== null && coupon.usesCount >= coupon.maxUses)
    return { label: 'Esgotado', tone: 'warning' };
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now)
    return { label: 'Agendado', tone: 'info' };
  return { label: 'Ativo', tone: 'success' };
}

/** Entrada de moeda que guarda centavos e só reformata o texto ao sair do campo. */
function MoneyField({
  label,
  name,
  cents,
  onChange,
  error,
  hint,
  required,
}: {
  label?: string;
  name: string;
  cents: number;
  onChange: (cents: number) => void;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  const [text, setText] = useState(() => centsToInput(cents));
  const last = useRef(cents);
  useEffect(() => {
    if (cents !== last.current) {
      last.current = cents;
      setText(centsToInput(cents));
    }
  }, [cents]);
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={name}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted">
          R$
        </span>
        <input
          id={name}
          name={name}
          inputMode="decimal"
          placeholder="0,00"
          className={`input pl-9 ${error ? 'border-danger' : ''}`}
          aria-invalid={Boolean(error)}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            const next = inputToCents(event.target.value) ?? 0;
            last.current = next;
            onChange(next);
          }}
          onBlur={() => setText(centsToInput(cents))}
        />
      </div>
    </Field>
  );
}

// ---------- Modal ----------

type CouponFormValues = {
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minSubtotalCents: number;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

function CouponModal({
  coupon,
  onClose,
  onSaved,
}: {
  coupon: Coupon | null;
  onClose: () => void;
  onSaved: (created: boolean) => void;
}) {
  const form = useZodForm(CouponInputSchema, {
    code: coupon?.code ?? '',
    description: coupon?.description ?? '',
    type: coupon?.type ?? 'percent',
    value: coupon?.value ?? 0,
    minSubtotalCents: coupon?.minSubtotalCents ?? 0,
    maxUses: coupon?.maxUses ?? null,
    maxUsesPerCustomer: coupon?.maxUsesPerCustomer ?? null,
    startsAt: coupon?.startsAt ?? null,
    endsAt: coupon?.endsAt ?? null,
    isActive: coupon?.isActive ?? true,
  } satisfies CouponFormValues);
  const values = form.values as CouponFormValues;
  const error = (field: keyof CouponFormValues) => translateZodMessage(form.errors[field]);
  const valueError = form.errors.value?.startsWith('Too small')
    ? 'Informe o valor do desconto'
    : error('value');

  const submit = form.handleSubmit(async (data) => {
    const input: CouponInput = { ...data, description: data.description?.trim() || null };
    if (coupon) await adminApi.updateCoupon(coupon.id, input);
    else await adminApi.createCoupon(input);
    onSaved(!coupon);
  });

  const setNullableInt = (field: 'maxUses' | 'maxUsesPerCustomer', raw: string) => {
    form.setField(field, raw === '' ? null : Math.max(0, Math.round(Number(raw))));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={coupon ? `Editar cupom ${coupon.code}` : 'Novo cupom'}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="coupon-form"
            loading={form.submitting}
            data-testid="coupon-save"
          >
            Salvar
          </Button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={submit} noValidate className="space-y-4">
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Código"
            name="code"
            required
            value={values.code}
            onChange={(event) =>
              form.setField('code', event.target.value.toUpperCase().replace(/\s+/g, ''))
            }
            error={error('code')}
            className="font-mono uppercase"
            placeholder="BEMVINDO10"
            maxLength={32}
            hint="Letras, números, hífen e sublinhado. O cliente digita este código na sacola."
            autoComplete="off"
            data-testid="coupon-code"
          />
          <Input
            label="Descrição"
            name="description"
            value={values.description}
            onChange={(event) => form.setField('description', event.target.value)}
            error={error('description')}
            placeholder="Ex.: 10% para novos clientes"
            maxLength={160}
            hint="Uso interno."
          />
          <Select
            label="Tipo de desconto"
            name="type"
            required
            options={TYPE_OPTIONS}
            value={values.type}
            onChange={(event) => {
              form.setField('type', event.target.value as CouponType);
              form.setField('value', 0);
            }}
            error={error('type')}
          />
          {values.type === 'percent' ? (
            <Input
              label="Percentual de desconto"
              name="value"
              required
              type="number"
              min={1}
              max={100}
              step={1}
              inputMode="numeric"
              value={values.value ? String(values.value) : ''}
              onChange={(event) =>
                form.setField(
                  'value',
                  event.target.value === '' ? 0 : Math.round(Number(event.target.value)),
                )
              }
              error={valueError}
              hint="De 1 a 100."
              placeholder="10"
              data-testid="coupon-value"
            />
          ) : (
            <MoneyField
              label="Valor do desconto"
              name="value"
              required
              cents={values.value}
              onChange={(cents) => form.setField('value', cents)}
              error={valueError}
              hint="Desconto fixo em reais sobre o subtotal."
            />
          )}
          <MoneyField
            label="Subtotal mínimo"
            name="minSubtotalCents"
            cents={values.minSubtotalCents}
            onChange={(cents) => form.setField('minSubtotalCents', cents)}
            error={error('minSubtotalCents')}
            hint="0 = sem valor mínimo."
          />
          <Input
            label="Limite total de usos"
            name="maxUses"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={values.maxUses ?? ''}
            onChange={(event) => setNullableInt('maxUses', event.target.value)}
            error={error('maxUses')}
            hint="Vazio = ilimitado."
            placeholder="Ilimitado"
          />
          <Input
            label="Limite por cliente"
            name="maxUsesPerCustomer"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={values.maxUsesPerCustomer ?? ''}
            onChange={(event) => setNullableInt('maxUsesPerCustomer', event.target.value)}
            error={error('maxUsesPerCustomer')}
            hint="Vazio = ilimitado."
            placeholder="Ilimitado"
          />
          <Input
            label="Válido a partir de"
            name="startsAt"
            type="datetime-local"
            value={isoToLocalInput(values.startsAt)}
            onChange={(event) => form.setField('startsAt', localInputToIso(event.target.value))}
            error={error('startsAt')}
            hint="Vazio = imediatamente."
          />
          <Input
            label="Válido até"
            name="endsAt"
            type="datetime-local"
            value={isoToLocalInput(values.endsAt)}
            onChange={(event) => form.setField('endsAt', localInputToIso(event.target.value))}
            error={error('endsAt')}
            hint="Vazio = sem data de término."
          />
        </div>
        <Checkbox
          name="isActive"
          label="Cupom ativo"
          checked={values.isActive}
          onChange={(event) => form.setField('isActive', event.target.checked)}
        />
      </form>
    </Modal>
  );
}

// ---------- Página ----------

export default function CouponsPage() {
  usePageMeta('Cupons');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const couponsQuery = useQuery({ queryKey: ['admin', 'coupons'], queryFn: adminApi.coupons });
  const [modal, setModal] = useState<Coupon | 'new' | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Coupon | null>(null);

  const deactivate = useMutation({
    mutationFn: (couponId: string) => adminApi.deleteCoupon(couponId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      toast('Cupom desativado');
      setToDeactivate(null);
    },
    onError: (error) => toast(errorMessage(error, 'Não foi possível desativar o cupom'), 'danger'),
  });

  const coupons = couponsQuery.data ?? [];
  const now = Date.now();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Promoções</p>
          <h1 className="heading text-2xl">Cupons</h1>
        </div>
        <Button
          type="button"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setModal('new')}
          data-testid="admin-new-coupon"
        >
          Novo cupom
        </Button>
      </div>

      {couponsQuery.isLoading ? (
        <PageLoader />
      ) : couponsQuery.isError ? (
        <ErrorState
          message={errorMessage(couponsQuery.error, 'Não foi possível carregar os cupons')}
          onRetry={() => couponsQuery.refetch()}
        />
      ) : coupons.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<TicketPercent className="h-8 w-8" />}
            title="Nenhum cupom cadastrado"
            text="Crie cupons percentuais ou de valor fixo, com validade e limites de uso."
            action={
              <Button
                type="button"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setModal('new')}
              >
                Novo cupom
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Desconto</th>
                <th>Mínimo</th>
                <th className="text-right">Usos</th>
                <th>Validade</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const status = couponStatus(coupon, now);
                return (
                  <tr key={coupon.id} data-testid="admin-coupon-row">
                    <td className="font-mono text-sm font-semibold tracking-wider text-gold">
                      {coupon.code}
                    </td>
                    <td
                      className="max-w-xs truncate text-muted"
                      title={coupon.description ?? undefined}
                    >
                      {coupon.description || '—'}
                    </td>
                    <td className="whitespace-nowrap font-medium text-cream">
                      {couponValueLabel(coupon)}
                    </td>
                    <td className="whitespace-nowrap">
                      {coupon.minSubtotalCents > 0 ? formatBRL(coupon.minSubtotalCents) : '—'}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {coupon.usesCount} / {coupon.maxUses ?? '∞'}
                      {coupon.maxUsesPerCustomer !== null && (
                        <div className="text-[11px] text-muted">
                          {coupon.maxUsesPerCustomer} por cliente
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted">
                      {validityLabel(coupon)}
                    </td>
                    <td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded p-1.5 text-ivory/70 hover:text-gold"
                          onClick={() => setModal(coupon)}
                          aria-label={`Editar cupom ${coupon.code}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {coupon.isActive && (
                          <button
                            type="button"
                            className="rounded p-1.5 text-ivory/70 hover:text-danger"
                            onClick={() => setToDeactivate(coupon)}
                            aria-label={`Desativar cupom ${coupon.code}`}
                            title="Desativar"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <CouponModal
          coupon={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={(created) => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
            toast(created ? 'Cupom criado' : 'Cupom salvo');
            setModal(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDeactivate)}
        onClose={() => setToDeactivate(null)}
        onConfirm={() => toDeactivate && deactivate.mutate(toDeactivate.id)}
        title="Desativar cupom"
        text={
          <p>
            O cupom <strong className="font-mono text-cream">{toDeactivate?.code}</strong> deixará
            de ser aceito na sacola. O histórico de usos é mantido e ele pode ser reativado depois
            pela edição.
          </p>
        }
        confirmLabel="Desativar"
        danger
        loading={deactivate.isPending}
      />
    </div>
  );
}
