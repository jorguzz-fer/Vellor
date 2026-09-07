import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BRAZIL_STATES,
  type BrazilState,
  calculateInstallments,
  formatBRL,
  SHIPPING_SERVICE_LABELS,
  SHIPPING_SERVICES,
  type ShippingRegionRate,
  type ShippingService,
  type StoreSettings,
  StoreSettingsSchema,
} from '@vellor/shared';
import { Plus, Save, Trash2 } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Alert, Badge, ErrorState, PageLoader, useToast } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form';
import { adminApi, ApiError } from '@/lib/api';
import { centsToInput, inputToCents, maskCepInput } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

type FieldErrors = Record<string, string>;
type Tab = 'store' | 'announcement' | 'shipping' | 'payments' | 'legal';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'store', label: 'Loja' },
  { id: 'announcement', label: 'Anúncio' },
  { id: 'shipping', label: 'Frete' },
  { id: 'payments', label: 'Pagamentos' },
  { id: 'legal', label: 'Textos legais' },
];

const STATE_OPTIONS = BRAZIL_STATES.map((uf) => ({ value: uf, label: uf }));
const PLACEHOLDER = '‹decidir›';
const LEGAL_FIELDS: Array<{ key: keyof StoreSettings['legal']; label: string; hint: string }> = [
  {
    key: 'privacyPolicy',
    label: 'Política de privacidade',
    hint: 'Exibida em /privacidade. LGPD: dados coletados, finalidade, base legal, retenção, direitos do titular e contato do encarregado.',
  },
  {
    key: 'termsOfService',
    label: 'Termos de compra',
    hint: 'Exibidos em /termos: prazos, pagamento, garantia, autenticidade e foro.',
  },
  {
    key: 'exchangePolicy',
    label: 'Trocas e devoluções',
    hint: 'Exibida em /trocas. CDC art. 49: 7 dias para arrependimento em compras online.',
  },
];

function tabForPath(path: string): Tab {
  const root = path.split('.')[0];
  return TABS.some((tab) => tab.id === root) ? (root as Tab) : 'store';
}

/** Traduz as mensagens padrão (em inglês) do Zod; mensagens customizadas dos schemas já vêm em pt-BR. */
function translateZodMessage(message: string): string {
  const rules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [
      /^Too small: expected string to have >=(\d+) character/,
      (m) => (m[1] === '1' ? 'Campo obrigatório' : `Mínimo de ${m[1]} caracteres`),
    ],
    [/^Too big: expected string to have <=(\d+) character/, (m) => `Máximo de ${m[1]} caracteres`],
    [
      /^Too small: expected array to have >=(\d+) item/,
      (m) => `Adicione pelo menos ${m[1]} ${m[1] === '1' ? 'item' : 'itens'}`,
    ],
    [/^Too small: expected number to be >=?(-?[\d.]+)/, (m) => `Valor mínimo: ${m[1]}`],
    [/^Too big: expected number to be <=?(-?[\d.]+)/, (m) => `Valor máximo: ${m[1]}`],
    [/^Invalid input: expected int/, () => 'Use um número inteiro'],
    [/^Invalid input: expected number/, () => 'Informe um número válido'],
    [/^Invalid input: expected string/, () => 'Campo obrigatório'],
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

function mapIssues(issues: z.ZodIssue[]): FieldErrors {
  const next: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_';
    if (next[key]) continue;
    let message = translateZodMessage(issue.message);
    if (key.endsWith('Cents') && (issue.code === 'too_small' || issue.code === 'too_big')) {
      const bound = issue.code === 'too_small' ? issue.minimum : issue.maximum;
      message = `${issue.code === 'too_small' ? 'Valor mínimo' : 'Valor máximo'}: ${formatBRL(Number(bound))}`;
    }
    if (key.endsWith('.states')) message = 'Informe ao menos uma UF válida';
    if (key === 'shipping.services') message = 'Selecione ao menos um serviço';
    if (key === 'shipping.fallbackTable') message = 'Cadastre ao menos uma região';
    next[key] = message;
  }
  return next;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

// ---------- Tabela de contingência (linhas locais com UFs em texto) ----------

interface RegionRow {
  key: string;
  name: string;
  statesText: string;
  pacCents: number;
  sedexCents: number;
  pacDays: number;
  sedexDays: number;
}

let regionSequence = 0;
const regionKey = () => `region-${++regionSequence}`;

function toRegionRows(table: ShippingRegionRate[]): RegionRow[] {
  return table.map((rate) => ({
    key: regionKey(),
    name: rate.name,
    statesText: rate.states.join(', '),
    pacCents: rate.pacCents,
    sedexCents: rate.sedexCents,
    pacDays: rate.pacDays,
    sedexDays: rate.sedexDays,
  }));
}

function parseStates(text: string): { valid: BrazilState[]; invalid: string[] } {
  const valid: BrazilState[] = [];
  const invalid: string[] = [];
  for (const token of text.split(/[\s,;]+/)) {
    const uf = token.trim().toUpperCase();
    if (!uf) continue;
    if ((BRAZIL_STATES as readonly string[]).includes(uf)) {
      if (!valid.includes(uf as BrazilState)) valid.push(uf as BrazilState);
    } else {
      invalid.push(uf);
    }
  }
  return { valid, invalid };
}

function toRate(row: RegionRow): ShippingRegionRate {
  return {
    name: row.name.trim(),
    states: parseStates(row.statesText).valid,
    pacCents: row.pacCents,
    sedexCents: row.sedexCents,
    pacDays: row.pacDays,
    sedexDays: row.sedexDays,
  };
}

// ---------- Campos auxiliares ----------

/** Entrada de moeda que guarda centavos e só reformata o texto ao sair do campo. */
function MoneyField({
  label,
  name,
  cents,
  onChange,
  error,
  hint,
  compact,
}: {
  label?: string;
  name: string;
  cents: number;
  onChange: (cents: number) => void;
  error?: string;
  hint?: string;
  compact?: boolean;
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
    <Field label={label} error={error} hint={hint} htmlFor={name}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted">
          R$
        </span>
        <input
          id={name}
          name={name}
          inputMode="decimal"
          placeholder="0,00"
          className={`input pl-9 ${compact ? 'min-w-28 py-1.5 text-xs' : ''} ${error ? 'border-danger' : ''}`}
          aria-invalid={Boolean(error)}
          aria-label={label ? undefined : name}
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

/**
 * Entrada numérica em texto com vírgula decimal (pt-BR). `scale` permite exibir
 * um valor armazenado como fração em percentual (0.0199 -> "1,99").
 */
function NumberField({
  label,
  name,
  value,
  onChange,
  decimals = 0,
  scale = 1,
  error,
  hint,
  suffix,
  compact,
  ariaLabel,
}: {
  label?: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
  decimals?: number;
  scale?: number;
  error?: string;
  hint?: string;
  suffix?: string;
  compact?: boolean;
  ariaLabel?: string;
}) {
  const format = useCallback(
    (n: number) => (n * scale).toFixed(decimals).replace('.', ','),
    [decimals, scale],
  );
  const [text, setText] = useState(() => format(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(format(value));
    }
  }, [value, format]);
  return (
    <Field label={label} error={error} hint={hint} htmlFor={name}>
      <div className="relative">
        <input
          id={name}
          name={name}
          inputMode="decimal"
          className={`input ${suffix ? 'pr-14' : ''} ${compact ? 'min-w-20 py-1.5 text-xs' : ''} ${error ? 'border-danger' : ''}`}
          aria-invalid={Boolean(error)}
          aria-label={label ? undefined : ariaLabel}
          value={text}
          onChange={(event) => {
            const raw = event.target.value;
            setText(raw);
            const parsed = Number(raw.trim().replace(',', '.'));
            if (raw.trim() === '' || !Number.isFinite(parsed)) return;
            const precision = decimals + (scale > 1 ? Math.round(Math.log10(scale)) : 0);
            const next = Number((parsed / scale).toFixed(precision));
            last.current = next;
            onChange(next);
          }}
          onBlur={() => setText(format(value))}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

// ---------- Página ----------

export default function SettingsPage() {
  usePageMeta('Configurações');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({ queryKey: ['admin', 'settings'], queryFn: adminApi.settings });
  const save = useMutation({
    mutationFn: (input: StoreSettings) => adminApi.updateSettings(input),
  });

  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [saved, setSaved] = useState<string>('');
  const [tab, setTab] = useState<Tab>('store');
  const [errors, setErrors] = useState<FieldErrors>({});

  // Inicializa o estado local uma única vez; refetches posteriores não sobrescrevem edições.
  useEffect(() => {
    if (query.data && settings === null) {
      setSettings(query.data);
      setRegions(toRegionRows(query.data.shipping.fallbackTable));
      setSaved(JSON.stringify(query.data));
    }
  }, [query.data, settings]);

  const current: StoreSettings | null = settings
    ? { ...settings, shipping: { ...settings.shipping, fallbackTable: regions.map(toRate) } }
    : null;
  const dirty = current !== null && JSON.stringify(current) !== saved;

  function clearErrors(keys: string[]) {
    setErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  const update = (fn: (draft: StoreSettings) => StoreSettings) =>
    setSettings((prev) => (prev ? fn(prev) : prev));
  const setStore = (patch: Partial<StoreSettings['store']>) => {
    update((s) => ({ ...s, store: { ...s.store, ...patch } }));
    clearErrors(Object.keys(patch).map((key) => `store.${key}`));
  };
  const setAddress = (patch: Partial<StoreSettings['store']['address']>) => {
    update((s) => ({ ...s, store: { ...s.store, address: { ...s.store.address, ...patch } } }));
    clearErrors(Object.keys(patch).map((key) => `store.address.${key}`));
  };
  const setAnnouncement = (patch: Partial<StoreSettings['announcement']>) => {
    update((s) => ({ ...s, announcement: { ...s.announcement, ...patch } }));
    clearErrors(Object.keys(patch).map((key) => `announcement.${key}`));
  };
  const setShipping = (patch: Partial<StoreSettings['shipping']>) => {
    update((s) => ({ ...s, shipping: { ...s.shipping, ...patch } }));
    clearErrors(Object.keys(patch).map((key) => `shipping.${key}`));
  };
  const setPayments = (patch: Partial<StoreSettings['payments']>) => {
    update((s) => ({ ...s, payments: { ...s.payments, ...patch } }));
    clearErrors(Object.keys(patch).map((key) => `payments.${key}`));
  };
  const setLegal = (patch: Partial<StoreSettings['legal']>) => {
    update((s) => ({ ...s, legal: { ...s.legal, ...patch } }));
    clearErrors(Object.keys(patch).map((key) => `legal.${key}`));
  };
  const setRegion = (index: number, patch: Partial<RegionRow>) => {
    setRegions((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    clearErrors(
      Object.keys(patch).map(
        (key) => `shipping.fallbackTable.${index}.${key === 'statesText' ? 'states' : key}`,
      ),
    );
  };
  const addRegion = () => {
    setRegions((prev) => [
      ...prev,
      {
        key: regionKey(),
        name: '',
        statesText: '',
        pacCents: 0,
        sedexCents: 0,
        pacDays: 1,
        sedexDays: 1,
      },
    ]);
    clearErrors(['shipping.fallbackTable']);
  };
  const removeRegion = (index: number) => {
    setRegions((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([key]) => !key.startsWith('shipping.fallbackTable.')),
      ),
    );
  };
  const toggleService = (service: ShippingService) => {
    if (!settings) return;
    const has = settings.shipping.services.includes(service);
    const next = has
      ? settings.shipping.services.filter((s) => s !== service)
      : [...settings.shipping.services, service];
    setShipping({ services: SHIPPING_SERVICES.filter((s) => next.includes(s)) });
  };

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!current) return;
    const next: FieldErrors = {};
    regions.forEach((row, index) => {
      const { invalid } = parseStates(row.statesText);
      if (invalid.length)
        next[`shipping.fallbackTable.${index}.states`] = `UF inválida: ${invalid.join(', ')}`;
    });
    const result = StoreSettingsSchema.safeParse(current);
    if (!result.success) {
      for (const [key, message] of Object.entries(mapIssues(result.error.issues)))
        if (!next[key]) next[key] = message;
    }
    if (Object.keys(next).length > 0 || !result.success) {
      setErrors(next);
      const first = Object.keys(next)[0];
      if (first) setTab(tabForPath(first));
      toast('Revise os campos destacados', 'danger');
      return;
    }
    try {
      const updated = await save.mutateAsync(result.data);
      setSettings(updated);
      setRegions(toRegionRows(updated.shipping.fallbackTable));
      setSaved(JSON.stringify(updated));
      setErrors({});
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast('Configurações salvas');
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const fieldErrors: FieldErrors = {};
        for (const [key, messages] of Object.entries(error.errors))
          fieldErrors[key] = messages[0] ?? error.message;
        setErrors(fieldErrors);
        const first = Object.keys(fieldErrors)[0];
        if (first) setTab(tabForPath(first));
      }
      toast(errorMessage(error, 'Não foi possível salvar as configurações'), 'danger');
    }
  }

  if (query.isError)
    return (
      <ErrorState
        message={errorMessage(query.error, 'Não foi possível carregar as configurações')}
        onRetry={() => query.refetch()}
      />
    );
  if (!settings) return <PageLoader />;

  const errorCountByTab = Object.keys(errors).reduce<Record<Tab, number>>(
    (acc, key) => {
      acc[tabForPath(key)] += 1;
      return acc;
    },
    { store: 0, announcement: 0, shipping: 0, payments: 0, legal: 0 },
  );
  const installmentPreview = calculateInstallments(100_000, settings.payments);
  const lastInstallment = installmentPreview[installmentPreview.length - 1];

  return (
    <form onSubmit={handleSave} noValidate className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Administração</p>
          <h1 className="heading text-2xl">Configurações</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dirty && <Badge tone="warning">Alterações não salvas</Badge>}
          <Button
            type="submit"
            icon={<Save className="h-4 w-4" />}
            loading={save.isPending}
            data-testid="settings-save"
          >
            Salvar
          </Button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Seções das configurações"
        className="scrollbar-none mb-6 flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          const count = errorCountByTab[item.id];
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={active}
              aria-controls={`panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                active
                  ? 'border-gold text-gold'
                  : 'border-transparent text-ivory/60 hover:text-ivory'
              }`}
            >
              {item.label}
              {count > 0 && (
                <span
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-noir"
                  aria-label={`${count} erro(s)`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="card p-5">
        {tab === 'store' && (
          <div className="space-y-8">
            <div>
              <h2 className="heading mb-4 text-lg">Identidade e contato</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Nome da loja"
                  name="store.name"
                  required
                  value={settings.store.name}
                  onChange={(e) => setStore({ name: e.target.value })}
                  error={errors['store.name']}
                />
                <Input
                  label="Slogan"
                  name="store.tagline"
                  value={settings.store.tagline}
                  onChange={(e) => setStore({ tagline: e.target.value })}
                  error={errors['store.tagline']}
                />
                <Input
                  label="Razão social"
                  name="store.legalName"
                  value={settings.store.legalName}
                  onChange={(e) => setStore({ legalName: e.target.value })}
                  error={errors['store.legalName']}
                />
                <Input
                  label="CNPJ"
                  name="store.cnpj"
                  value={settings.store.cnpj}
                  onChange={(e) => setStore({ cnpj: e.target.value })}
                  error={errors['store.cnpj']}
                  placeholder="00.000.000/0000-00"
                />
                <Input
                  label="E-mail de atendimento"
                  name="store.email"
                  type="email"
                  value={settings.store.email}
                  onChange={(e) => setStore({ email: e.target.value })}
                  error={errors['store.email']}
                />
                <Input
                  label="Telefone"
                  name="store.phone"
                  value={settings.store.phone}
                  onChange={(e) => setStore({ phone: e.target.value })}
                  error={errors['store.phone']}
                  placeholder="(11) 0000-0000"
                />
                <Input
                  label="WhatsApp"
                  name="store.whatsapp"
                  inputMode="numeric"
                  value={settings.store.whatsapp}
                  onChange={(e) => setStore({ whatsapp: e.target.value.replace(/\D/g, '') })}
                  error={errors['store.whatsapp']}
                  hint="DDI + DDD + número, só dígitos. Ex.: 5511999999999"
                />
                <Input
                  label="Instagram"
                  name="store.instagram"
                  value={settings.store.instagram}
                  onChange={(e) => setStore({ instagram: e.target.value.replace(/^@/, '') })}
                  error={errors['store.instagram']}
                  hint="Usuário, sem @."
                />
                <Input
                  label="Horário de atendimento"
                  name="store.businessHours"
                  value={settings.store.businessHours}
                  onChange={(e) => setStore({ businessHours: e.target.value })}
                  error={errors['store.businessHours']}
                  wrapperClassName="md:col-span-2"
                  placeholder="Segunda a sexta, das 9h às 18h"
                />
              </div>
            </div>
            <div>
              <h2 className="heading mb-1 text-lg">Endereço</h2>
              <p className="mb-4 text-xs text-muted">
                Aparece no rodapé da loja e nos documentos fiscais.
              </p>
              <div className="grid gap-4 md:grid-cols-6">
                <Input
                  label="CEP"
                  name="store.address.cep"
                  inputMode="numeric"
                  value={settings.store.address.cep}
                  onChange={(e) => setAddress({ cep: maskCepInput(e.target.value) })}
                  error={errors['store.address.cep']}
                  wrapperClassName="md:col-span-2"
                />
                <Input
                  label="Logradouro"
                  name="store.address.street"
                  value={settings.store.address.street}
                  onChange={(e) => setAddress({ street: e.target.value })}
                  error={errors['store.address.street']}
                  wrapperClassName="md:col-span-4"
                />
                <Input
                  label="Número"
                  name="store.address.number"
                  value={settings.store.address.number}
                  onChange={(e) => setAddress({ number: e.target.value })}
                  error={errors['store.address.number']}
                  wrapperClassName="md:col-span-2"
                />
                <Input
                  label="Complemento"
                  name="store.address.complement"
                  value={settings.store.address.complement}
                  onChange={(e) => setAddress({ complement: e.target.value })}
                  error={errors['store.address.complement']}
                  wrapperClassName="md:col-span-4"
                />
                <Input
                  label="Bairro"
                  name="store.address.district"
                  value={settings.store.address.district}
                  onChange={(e) => setAddress({ district: e.target.value })}
                  error={errors['store.address.district']}
                  wrapperClassName="md:col-span-2"
                />
                <Input
                  label="Cidade"
                  name="store.address.city"
                  value={settings.store.address.city}
                  onChange={(e) => setAddress({ city: e.target.value })}
                  error={errors['store.address.city']}
                  wrapperClassName="md:col-span-3"
                />
                <Select
                  label="UF"
                  name="store.address.state"
                  options={STATE_OPTIONS}
                  placeholder="UF"
                  value={settings.store.address.state}
                  onChange={(e) => setAddress({ state: e.target.value })}
                  error={errors['store.address.state']}
                  wrapperClassName="md:col-span-1"
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'announcement' && (
          <div className="space-y-4">
            <h2 className="heading mb-4 text-lg">Barra de anúncio</h2>
            <Checkbox
              name="announcement.enabled"
              label="Exibir a barra de anúncio no topo da loja"
              checked={settings.announcement.enabled}
              onChange={(e) => setAnnouncement({ enabled: e.target.checked })}
            />
            <Input
              label="Texto"
              name="announcement.text"
              value={settings.announcement.text}
              onChange={(e) => setAnnouncement({ text: e.target.value })}
              error={errors['announcement.text']}
              hint={`${settings.announcement.text.length}/200 caracteres`}
              placeholder="Envio segurado para todo o Brasil · Pix, boleto ou cartão em até 12x"
            />
          </div>
        )}

        {tab === 'shipping' && (
          <div className="space-y-8">
            <div>
              <h2 className="heading mb-4 text-lg">Correios e seguro</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="CEP de origem"
                  name="shipping.originCep"
                  inputMode="numeric"
                  value={settings.shipping.originCep}
                  onChange={(e) => setShipping({ originCep: maskCepInput(e.target.value) })}
                  error={errors['shipping.originCep']}
                  hint="CEP de onde as peças são postadas."
                />
                <fieldset>
                  <legend className="label">Serviços oferecidos</legend>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                    {SHIPPING_SERVICES.map((service) => (
                      <Checkbox
                        key={service}
                        name={`shipping.services.${service}`}
                        label={SHIPPING_SERVICE_LABELS[service]}
                        checked={settings.shipping.services.includes(service)}
                        onChange={() => toggleService(service)}
                      />
                    ))}
                  </div>
                  {errors['shipping.services'] && (
                    <p className="mt-1 text-xs text-danger" role="alert">
                      {errors['shipping.services']}
                    </p>
                  )}
                </fieldset>
                <NumberField
                  label="Seguro (% do valor declarado)"
                  name="shipping.insurancePercent"
                  decimals={2}
                  suffix="%"
                  value={settings.shipping.insurancePercent}
                  onChange={(value) => setShipping({ insurancePercent: value })}
                  error={errors['shipping.insurancePercent']}
                  hint="Percentual cobrado sobre o valor da peça (0 a 10%)."
                />
                <MoneyField
                  label="Seguro mínimo"
                  name="shipping.insuranceMinCents"
                  cents={settings.shipping.insuranceMinCents}
                  onChange={(cents) => setShipping({ insuranceMinCents: cents })}
                  error={errors['shipping.insuranceMinCents']}
                />
                <MoneyField
                  label="Valor máximo declarável por pacote"
                  name="shipping.maxDeclaredValueCents"
                  cents={settings.shipping.maxDeclaredValueCents}
                  onChange={(cents) => setShipping({ maxDeclaredValueCents: cents })}
                  error={errors['shipping.maxDeclaredValueCents']}
                  hint="Limite dos Correios. Acima disso, divida a remessa ou use transportadora."
                />
                <NumberField
                  label="Prazo de postagem (dias úteis)"
                  name="shipping.handlingDays"
                  value={settings.shipping.handlingDays}
                  onChange={(value) => setShipping({ handlingDays: value })}
                  error={errors['shipping.handlingDays']}
                  hint="Dias úteis para postar após a confirmação do pagamento."
                />
                <MoneyField
                  label="Frete grátis a partir de"
                  name="shipping.freeShippingThresholdCents"
                  cents={settings.shipping.freeShippingThresholdCents}
                  onChange={(cents) => setShipping({ freeShippingThresholdCents: cents })}
                  error={errors['shipping.freeShippingThresholdCents']}
                  hint="Subtotal mínimo para frete grátis. 0 desativa; o seguro continua incluído."
                />
              </div>
            </div>

            <div>
              <h2 className="heading mb-1 text-lg">Tabela de contingência</h2>
              <Alert tone="info" className="mb-4">
                Esta tabela é usada quando a API dos Correios não está configurada ou fica
                indisponível. Informe o valor e o prazo por região; o seguro é somado à parte.
              </Alert>
              {errors['shipping.fallbackTable'] && (
                <Alert tone="danger" className="mb-4">
                  {errors['shipping.fallbackTable']}
                </Alert>
              )}
              <div className="overflow-x-auto">
                <table className="table min-w-[900px]">
                  <thead>
                    <tr>
                      <th>Região</th>
                      <th>UFs</th>
                      <th>PAC</th>
                      <th>PAC (dias)</th>
                      <th>SEDEX</th>
                      <th>SEDEX (dias)</th>
                      <th>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {regions.map((row, index) => {
                      const rowError = (field: string) =>
                        errors[`shipping.fallbackTable.${index}.${field}`];
                      const { invalid } = parseStates(row.statesText);
                      const statesError = invalid.length
                        ? `UF inválida: ${invalid.join(', ')}`
                        : rowError('states');
                      return (
                        <tr key={row.key}>
                          <td>
                            <input
                              className={`input min-w-32 py-1.5 text-xs ${rowError('name') ? 'border-danger' : ''}`}
                              aria-label={`Nome da região ${index + 1}`}
                              value={row.name}
                              onChange={(e) => setRegion(index, { name: e.target.value })}
                              placeholder="Ex.: Sudeste"
                            />
                            {rowError('name') && (
                              <p className="mt-1 text-[11px] text-danger" role="alert">
                                {rowError('name')}
                              </p>
                            )}
                          </td>
                          <td>
                            <input
                              className={`input min-w-48 py-1.5 text-xs uppercase ${statesError ? 'border-danger' : ''}`}
                              aria-label={`UFs da região ${index + 1}`}
                              value={row.statesText}
                              onChange={(e) => setRegion(index, { statesText: e.target.value })}
                              placeholder="SP, RJ, MG, ES"
                            />
                            {statesError && (
                              <p className="mt-1 text-[11px] text-danger" role="alert">
                                {statesError}
                              </p>
                            )}
                          </td>
                          <td>
                            <MoneyField
                              name={`shipping.fallbackTable.${index}.pacCents`}
                              compact
                              cents={row.pacCents}
                              onChange={(cents) => setRegion(index, { pacCents: cents })}
                              error={rowError('pacCents')}
                            />
                          </td>
                          <td>
                            <NumberField
                              name={`shipping.fallbackTable.${index}.pacDays`}
                              compact
                              ariaLabel={`Prazo PAC da região ${index + 1}`}
                              value={row.pacDays}
                              onChange={(value) => setRegion(index, { pacDays: value })}
                              error={rowError('pacDays')}
                            />
                          </td>
                          <td>
                            <MoneyField
                              name={`shipping.fallbackTable.${index}.sedexCents`}
                              compact
                              cents={row.sedexCents}
                              onChange={(cents) => setRegion(index, { sedexCents: cents })}
                              error={rowError('sedexCents')}
                            />
                          </td>
                          <td>
                            <NumberField
                              name={`shipping.fallbackTable.${index}.sedexDays`}
                              compact
                              ariaLabel={`Prazo SEDEX da região ${index + 1}`}
                              value={row.sedexDays}
                              onChange={(value) => setRegion(index, { sedexDays: value })}
                              error={rowError('sedexDays')}
                            />
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="rounded p-1.5 text-ivory/60 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                              onClick={() => removeRegion(index)}
                              disabled={regions.length <= 1}
                              aria-label={`Remover região ${index + 1}`}
                              title={
                                regions.length <= 1
                                  ? 'Mantenha pelo menos uma região'
                                  : 'Remover região'
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={addRegion}
                >
                  Adicionar região
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div className="space-y-6">
            <div>
              <h2 className="heading mb-1 text-lg">Cartão e parcelamento</h2>
              <p className="mb-4 text-xs text-muted">
                Regras aplicadas ao checkout e às parcelas exibidas na página do produto.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  label="Máximo de parcelas"
                  name="payments.maxInstallments"
                  value={settings.payments.maxInstallments}
                  onChange={(value) => setPayments({ maxInstallments: value })}
                  error={errors['payments.maxInstallments']}
                  hint="De 1 a 12."
                />
                <MoneyField
                  label="Valor mínimo da parcela"
                  name="payments.minInstallmentCents"
                  cents={settings.payments.minInstallmentCents}
                  onChange={(cents) => setPayments({ minInstallmentCents: cents })}
                  error={errors['payments.minInstallmentCents']}
                  hint="Parcelas abaixo deste valor não são oferecidas."
                />
                <NumberField
                  label="Parcelas sem juros"
                  name="payments.interestFreeInstallments"
                  value={settings.payments.interestFreeInstallments}
                  onChange={(value) => setPayments({ interestFreeInstallments: value })}
                  error={errors['payments.interestFreeInstallments']}
                  hint="Até quantas parcelas o cliente não paga juros."
                />
                <NumberField
                  label="Juros ao mês"
                  name="payments.monthlyInterestRate"
                  decimals={2}
                  scale={100}
                  suffix="% a.m."
                  value={settings.payments.monthlyInterestRate}
                  onChange={(value) => setPayments({ monthlyInterestRate: value })}
                  error={errors['payments.monthlyInterestRate']}
                  hint="Aplicado (Tabela Price) acima das parcelas sem juros. Ex.: 1,99. Máximo 20."
                />
              </div>
              {lastInstallment && (
                <p className="mt-3 text-xs text-muted">
                  Exemplo para {formatBRL(100_000)}: {lastInstallment.label}
                  {installmentPreview.length < settings.payments.maxInstallments
                    ? ' (parcelas maiores ficam abaixo do valor mínimo)'
                    : ''}
                  .
                </p>
              )}
            </div>
            <div>
              <h2 className="heading mb-4 text-lg">Pix e boleto</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  label="Desconto no Pix"
                  name="payments.pixDiscountPercent"
                  decimals={2}
                  suffix="%"
                  value={settings.payments.pixDiscountPercent}
                  onChange={(value) => setPayments({ pixDiscountPercent: value })}
                  error={errors['payments.pixDiscountPercent']}
                  hint="0 a 30%. 0 desativa o desconto."
                />
                <NumberField
                  label="Validade do Pix (minutos)"
                  name="payments.pixExpirationMinutes"
                  value={settings.payments.pixExpirationMinutes}
                  onChange={(value) => setPayments({ pixExpirationMinutes: value })}
                  error={errors['payments.pixExpirationMinutes']}
                  hint="De 10 a 1440 minutos."
                />
                <NumberField
                  label="Vencimento do boleto (dias)"
                  name="payments.boletoDueDays"
                  value={settings.payments.boletoDueDays}
                  onChange={(value) => setPayments({ boletoDueDays: value })}
                  error={errors['payments.boletoDueDays']}
                  hint="De 1 a 15 dias."
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'legal' && (
          <div className="space-y-8">
            {LEGAL_FIELDS.map((field) => {
              const text = settings.legal[field.key];
              return (
                <div key={field.key}>
                  {text.includes(PLACEHOLDER) && (
                    <Alert tone="warning" className="mb-3">
                      Este texto ainda contém trechos marcados com {PLACEHOLDER} que precisam ser
                      definidos antes da publicação.
                    </Alert>
                  )}
                  <Textarea
                    label={field.label}
                    name={`legal.${field.key}`}
                    rows={14}
                    className="font-sans text-sm leading-relaxed"
                    value={text}
                    onChange={(e) => setLegal({ [field.key]: e.target.value })}
                    error={errors[`legal.${field.key}`]}
                    hint={`${text.length.toLocaleString('pt-BR')}/50.000 caracteres · ${field.hint}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-4">
        {dirty && <span className="text-xs text-muted">Há alterações não salvas.</span>}
        <Button type="submit" icon={<Save className="h-4 w-4" />} loading={save.isPending}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
