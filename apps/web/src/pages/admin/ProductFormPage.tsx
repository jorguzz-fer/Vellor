import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AdminProduct,
  type AttributeField,
  attributesForKind,
  type CategoryKind,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUSES,
  type ProductImage as ProductImageData,
  type ProductInput,
  ProductInputSchema,
  type ProductStatus,
  StockAdjustInputSchema,
} from '@vellor/shared';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  Boxes,
  ExternalLink,
  ImagePlus,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { z } from 'zod';
import { ProductImage } from '@/components/ProductImage';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert, Badge, ErrorState, PageLoader, useToast } from '@/components/ui/feedback';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { adminApi, ApiError } from '@/lib/api';
import { centsToInput, inputToCents } from '@/lib/format';
import { usePageMeta } from '@/lib/meta';

// ---------- Tipos do formulário ----------

type FieldErrors = Record<string, string>;

interface VariantRow {
  /** Chave local estável para o React (variações novas ainda não têm id). */
  key: string;
  id?: string;
  /** SKU carregado da API: usado para saber quais linhas podem conflitar em `sku_in_use`. */
  originalSku: string;
  sku: string;
  name: string;
  /** Preço em texto ("1.234,56"); vazio = herda o preço do produto. */
  price: string;
  compareAtPrice: string;
  stock: string;
  optionKey: string;
  optionValue: string;
  /** Demais pares de optionValues além do primeiro (preservados no salvamento). */
  extraOptions: Record<string, string>;
  imageId: string | null;
  isActive: boolean;
  reservedQuantity: number;
}

interface FormState {
  name: string;
  slug: string;
  brand: string;
  categoryId: string;
  collectionId: string;
  status: ProductStatus;
  isFeatured: boolean;
  isNew: boolean;
  isBestseller: boolean;
  shortDescription: string;
  description: string;
  price: string;
  compareAtPrice: string;
  attributes: Record<string, string | number>;
  weightGrams: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  seoTitle: string;
  seoDescription: string;
  variants: VariantRow[];
}

const STATUS_OPTIONS = PRODUCT_STATUSES.map((status) => ({
  value: status,
  label: PRODUCT_STATUS_LABELS[status],
}));

/** Mapeia campos da linha de variação para o caminho correspondente no schema (para limpar erros). */
const VARIANT_ERROR_KEYS: Partial<Record<keyof VariantRow, string>> = {
  sku: 'sku',
  name: 'name',
  price: 'priceCents',
  compareAtPrice: 'compareAtPriceCents',
  stock: 'stockQuantity',
  optionKey: 'optionValues',
  optionValue: 'optionValues',
};

let keySequence = 0;
const nextKey = () => `variant-${++keySequence}`;

function emptyVariant(name = 'Padrão'): VariantRow {
  return {
    key: nextKey(),
    originalSku: '',
    sku: '',
    name,
    price: '',
    compareAtPrice: '',
    stock: '0',
    optionKey: '',
    optionValue: '',
    extraOptions: {},
    imageId: null,
    isActive: true,
    reservedQuantity: 0,
  };
}

function emptyForm(): FormState {
  return {
    name: '',
    slug: '',
    brand: '',
    categoryId: '',
    collectionId: '',
    status: 'draft',
    isFeatured: false,
    isNew: false,
    isBestseller: false,
    shortDescription: '',
    description: '',
    price: '',
    compareAtPrice: '',
    attributes: {},
    weightGrams: '500',
    lengthCm: '20',
    widthCm: '15',
    heightCm: '10',
    seoTitle: '',
    seoDescription: '',
    variants: [emptyVariant()],
  };
}

const decimalToInput = (value: number) => String(value).replace('.', ',');

function fromProduct(product: AdminProduct): FormState {
  return {
    name: product.name,
    slug: product.slug,
    brand: product.brand ?? '',
    categoryId: product.categoryId,
    collectionId: product.collectionId ?? '',
    status: product.status,
    isFeatured: product.isFeatured,
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    shortDescription: product.shortDescription ?? '',
    description: product.description ?? '',
    price: centsToInput(product.priceCents),
    compareAtPrice: centsToInput(product.compareAtPriceCents),
    attributes: { ...product.attributes },
    weightGrams: String(product.weightGrams),
    lengthCm: decimalToInput(product.lengthCm),
    widthCm: decimalToInput(product.widthCm),
    heightCm: decimalToInput(product.heightCm),
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
    variants: product.variants.length
      ? product.variants.map((variant) => {
          const [first, ...rest] = Object.entries(variant.optionValues);
          return {
            key: nextKey(),
            id: variant.id,
            originalSku: variant.sku.toUpperCase(),
            sku: variant.sku,
            name: variant.name,
            // A API devolve o preço efetivo (da variação ou, na falta, do produto):
            // quando é igual ao do produto tratamos como "herdado".
            price:
              variant.priceCents === product.priceCents ? '' : centsToInput(variant.priceCents),
            compareAtPrice:
              variant.compareAtPriceCents === null ||
              variant.compareAtPriceCents === product.compareAtPriceCents
                ? ''
                : centsToInput(variant.compareAtPriceCents),
            stock: String(variant.stockQuantity),
            optionKey: first?.[0] ?? '',
            optionValue: first?.[1] ?? '',
            extraOptions: Object.fromEntries(rest),
            imageId: variant.imageId,
            isActive: variant.isActive,
            reservedQuantity: variant.reservedQuantity,
          };
        })
      : [emptyVariant()],
  };
}

function parseNumber(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  return Number(trimmed.replace(',', '.'));
}

/** Monta o corpo enviado à API a partir do estado do formulário (validado depois com ProductInputSchema). */
function buildPayload(
  form: FormState,
  allowedAttributeKeys: Set<string> | null,
): Record<string, unknown> {
  const attributes: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(form.attributes)) {
    if (value === '' || value === null || value === undefined) continue;
    // Chaves internas (prefixo "_") são preservadas; as demais só se pertencem à ficha do tipo atual.
    if (key.startsWith('_') || !allowedAttributeKeys || allowedAttributeKeys.has(key))
      attributes[key] = value;
  }
  return {
    name: form.name,
    slug: form.slug.trim() || undefined,
    brand: form.brand.trim() || null,
    categoryId: form.categoryId,
    collectionId: form.collectionId || null,
    status: form.status,
    shortDescription: form.shortDescription.trim() || null,
    description: form.description.trim() || null,
    priceCents: inputToCents(form.price) ?? -1,
    compareAtPriceCents: inputToCents(form.compareAtPrice),
    isFeatured: form.isFeatured,
    isNew: form.isNew,
    isBestseller: form.isBestseller,
    attributes,
    weightGrams: parseNumber(form.weightGrams),
    lengthCm: parseNumber(form.lengthCm),
    widthCm: parseNumber(form.widthCm),
    heightCm: parseNumber(form.heightCm),
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    variants: form.variants.map((variant, index) => {
      const optionKey = variant.optionKey.trim();
      return {
        id: variant.id,
        sku: variant.sku.trim().toUpperCase(),
        name: variant.name.trim(),
        priceCents: inputToCents(variant.price),
        compareAtPriceCents: inputToCents(variant.compareAtPrice),
        stockQuantity: parseNumber(variant.stock),
        optionValues: optionKey
          ? { ...variant.extraOptions, [optionKey]: variant.optionValue.trim() }
          : variant.extraOptions,
        imageId: variant.imageId,
        position: index,
        isActive: variant.isActive,
      };
    }),
  };
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
    [/^Too big: expected array to have <=(\d+) item/, (m) => `Máximo de ${m[1]} itens`],
    [/^Too small: expected number to be >=?(-?[\d.]+)/, (m) => `Valor mínimo: ${m[1]}`],
    [/^Too big: expected number to be <=?(-?[\d.]+)/, (m) => `Valor máximo: ${m[1]}`],
    [/^Invalid input: expected int/, () => 'Use um número inteiro'],
    [/^Invalid input: expected number/, () => 'Informe um número válido'],
    [/^Invalid input: expected string/, () => 'Campo obrigatório'],
    [/^Invalid UUID/, () => 'Selecione uma opção válida'],
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
    if (!next[key]) next[key] = translateZodMessage(issue.message);
  }
  return next;
}

function duplicateSkuErrors(variants: VariantRow[]): FieldErrors {
  const seen = new Map<string, number>();
  const errors: FieldErrors = {};
  variants.forEach((variant, index) => {
    const sku = variant.sku.trim().toUpperCase();
    if (!sku) return;
    const firstIndex = seen.get(sku);
    if (firstIndex === undefined) {
      seen.set(sku, index);
      return;
    }
    errors[`variants.${firstIndex}.sku`] = 'SKU repetido neste produto';
    errors[`variants.${index}.sku`] = 'SKU repetido neste produto';
  });
  return errors;
}

function groupFields(fields: readonly AttributeField[]): Array<[string, AttributeField[]]> {
  const groups = new Map<string, AttributeField[]>();
  for (const field of fields) {
    const list = groups.get(field.group);
    if (list) list.push(field);
    else groups.set(field.group, [field]);
  }
  return [...groups.entries()];
}

function errorMessage(error: unknown, fallback = 'Erro inesperado. Tente novamente.'): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

// ---------- Campos auxiliares ----------

interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  error?: string;
}

/** Entrada de moeda em reais (texto "1.234,56"); normaliza o formato ao sair do campo. */
function MoneyInput({
  value,
  onChange,
  label,
  hint,
  error,
  id,
  name,
  required,
  className = '',
  ...rest
}: MoneyInputProps) {
  const inputId = id ?? name;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted">
          R$
        </span>
        <input
          id={inputId}
          name={name}
          inputMode="decimal"
          placeholder="0,00"
          className={`input pl-9 ${error ? 'border-danger' : ''} ${className}`}
          aria-invalid={Boolean(error)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            const cents = inputToCents(value);
            onChange(cents === null ? '' : centsToInput(cents));
          }}
          {...rest}
        />
      </div>
    </Field>
  );
}

interface CellInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

/** Input compacto para tabelas editáveis. */
function CellInput({ error, className = '', ...rest }: CellInputProps) {
  return (
    <div>
      <input
        className={`input min-w-24 py-1.5 text-xs ${error ? 'border-danger' : ''} ${className}`}
        aria-invalid={Boolean(error)}
        {...rest}
      />
      {error && (
        <p className="mt-1 text-[11px] text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function AttributeInput({
  field,
  value,
  onChange,
}: {
  field: AttributeField;
  value: string | number | undefined;
  onChange: (value: string | number | undefined) => void;
}) {
  const name = `attr-${field.key}`;
  const label = field.unit ? `${field.label} (${field.unit})` : field.label;
  switch (field.type) {
    case 'number':
      return (
        <Input
          label={label}
          name={name}
          type="number"
          step="any"
          inputMode="decimal"
          placeholder={field.placeholder}
          value={value === undefined ? '' : String(value)}
          onChange={(event) =>
            onChange(event.target.value === '' ? undefined : Number(event.target.value))
          }
        />
      );
    case 'select':
      return (
        <Select
          label={label}
          name={name}
          options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
          placeholder="Selecione"
          value={value === undefined ? '' : String(value)}
          onChange={(event) => onChange(event.target.value || undefined)}
        />
      );
    case 'textarea':
      return (
        <Textarea
          label={label}
          name={name}
          rows={3}
          className="min-h-20"
          placeholder={field.placeholder}
          value={value === undefined ? '' : String(value)}
          onChange={(event) => onChange(event.target.value)}
          wrapperClassName="sm:col-span-2"
        />
      );
    default:
      return (
        <Input
          label={label}
          name={name}
          placeholder={field.placeholder}
          value={value === undefined ? '' : String(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}

// ---------- Página ----------

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const productQuery = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => adminApi.product(id ?? ''),
    enabled: isEdit,
  });
  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: adminApi.categories,
    staleTime: 5 * 60_000,
  });
  const collectionsQuery = useQuery({
    queryKey: ['admin', 'collections'],
    queryFn: adminApi.collections,
    staleTime: 5 * 60_000,
  });
  const product = isEdit ? productQuery.data : undefined;

  usePageMeta(isEdit ? `Editar produto${product ? `: ${product.name}` : ''}` : 'Novo produto');

  const [form, setForm] = useState<FormState>(emptyForm);
  const [images, setImages] = useState<ProductImageData[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [imageToDelete, setImageToDelete] = useState<ProductImageData | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockForm, setStockForm] = useState({ variantId: '', delta: '', reason: '' });
  const [stockErrors, setStockErrors] = useState<FieldErrors>({});

  // Inicializa o formulário uma única vez por produto (refetches em segundo plano não sobrescrevem edições).
  useEffect(() => {
    if (!isEdit) {
      if (loadedFor.current !== 'new') {
        loadedFor.current = 'new';
        setForm(emptyForm());
        setImages([]);
        setErrors({});
        setFormError(null);
      }
      return;
    }
    if (product && loadedFor.current !== product.id) {
      loadedFor.current = product.id;
      setForm(fromProduct(product));
      setImages(product.images);
      setErrors({});
      setFormError(null);
    }
  }, [isEdit, product]);

  const save = useMutation({
    mutationFn: (input: ProductInput) =>
      id ? adminApi.updateProduct(id, input) : adminApi.createProduct(input),
  });
  const adjust = useMutation({ mutationFn: adminApi.adjustStock });
  const archive = useMutation({
    mutationFn: (productId: string) => adminApi.deleteProduct(productId),
  });

  const categories = categoriesQuery.data ?? [];
  const collections = collectionsQuery.data ?? [];
  const selectedCategory = categories.find((category) => category.id === form.categoryId);
  const kind: CategoryKind | undefined = selectedCategory?.kind;
  const attributeFields = kind ? attributesForKind(kind) : [];
  const attributeGroups = groupFields(attributeFields);
  const categoryCollections = collections.filter(
    (collection) => collection.categoryId === form.categoryId,
  );
  const savedVariants = form.variants.filter((variant): variant is VariantRow & { id: string } =>
    Boolean(variant.id),
  );

  // ---------- Atualizações de estado ----------

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

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearErrors([key]);
  }

  function setCategory(categoryId: string) {
    setForm((prev) => {
      const keepCollection = collections.some(
        (collection) => collection.id === prev.collectionId && collection.categoryId === categoryId,
      );
      return { ...prev, categoryId, collectionId: keepCollection ? prev.collectionId : '' };
    });
    clearErrors(['categoryId', 'collectionId']);
  }

  function setAttribute(key: string, value: string | number | undefined) {
    setForm((prev) => {
      const attributes = { ...prev.attributes };
      if (value === undefined || value === '') delete attributes[key];
      else attributes[key] = value;
      return { ...prev, attributes };
    });
  }

  function setVariant(index: number, patch: Partial<VariantRow>) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, ...patch } : variant,
      ),
    }));
    clearErrors(
      Object.keys(patch).map(
        (key) => `variants.${index}.${VARIANT_ERROR_KEYS[key as keyof VariantRow] ?? key}`,
      ),
    );
  }

  function addVariant() {
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, emptyVariant(`Variação ${prev.variants.length + 1}`)],
    }));
    clearErrors(['variants']);
  }

  function removeVariant(index: number) {
    setForm((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
    // Os índices mudam: descarta os erros das variações para não apontar para a linha errada.
    setErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith('variants.'))),
    );
  }

  // ---------- Salvar ----------

  function handleApiError(error: unknown) {
    if (!(error instanceof ApiError)) {
      const message = errorMessage(error);
      setFormError(message);
      toast(message, 'danger');
      return;
    }
    const next: FieldErrors = {};
    if (error.errors) {
      for (const [field, messages] of Object.entries(error.errors))
        next[field] = messages[0] ?? error.message;
    }
    if (error.code === 'sku_in_use') {
      // A API não diz qual SKU conflitou: destacamos as linhas novas ou cujo SKU foi alterado.
      const candidates = form.variants
        .map((variant, index) => ({ variant, index }))
        .filter(
          ({ variant }) => !variant.id || variant.sku.trim().toUpperCase() !== variant.originalSku,
        );
      const targets = candidates.length
        ? candidates
        : form.variants.map((variant, index) => ({ variant, index }));
      for (const { index } of targets) next[`variants.${index}.sku`] = error.message;
    }
    if (error.code === 'duplicate_sku') Object.assign(next, duplicateSkuErrors(form.variants));
    if (error.code === 'stock_below_reserved' || error.code === 'variant_reserved') {
      const match = /A variação (\S+) tem/.exec(error.message);
      const index = match
        ? form.variants.findIndex(
            (variant) => variant.sku.trim().toUpperCase() === match[1]?.toUpperCase(),
          )
        : -1;
      if (index >= 0) next[`variants.${index}.stockQuantity`] = error.message;
    }
    setErrors((prev) => ({ ...prev, ...next }));
    setFormError(error.message);
    toast(error.message, 'danger');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const duplicates = duplicateSkuErrors(form.variants);
    if (Object.keys(duplicates).length) {
      setErrors(duplicates);
      toast('Há SKUs repetidos nas variações', 'danger');
      return;
    }
    const allowedKeys =
      kind && kind !== 'other' ? new Set(attributeFields.map((field) => field.key)) : null;
    const result = ProductInputSchema.safeParse(buildPayload(form, allowedKeys));
    if (!result.success) {
      setErrors(mapIssues(result.error.issues));
      toast('Revise os campos destacados', 'danger');
      return;
    }
    try {
      const saved = await save.mutateAsync(result.data);
      queryClient.setQueryData(['admin', 'product', saved.id], saved);
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      setErrors({});
      if (isEdit) {
        loadedFor.current = saved.id;
        setForm(fromProduct(saved));
        setImages(saved.images);
        toast('Produto salvo');
      } else {
        toast('Produto criado. Agora você já pode enviar imagens.');
        navigate(`/admin/produtos/${saved.id}`);
      }
    } catch (error) {
      handleApiError(error);
    }
  }

  // ---------- Estoque e arquivamento ----------

  function openStock() {
    setStockForm({ variantId: savedVariants[0]?.id ?? '', delta: '', reason: '' });
    setStockErrors({});
    setStockOpen(true);
  }

  async function submitStock() {
    const result = StockAdjustInputSchema.safeParse({
      variantId: stockForm.variantId,
      delta: parseNumber(stockForm.delta),
      reason: stockForm.reason.trim(),
    });
    if (!result.success) {
      setStockErrors(mapIssues(result.error.issues));
      return;
    }
    try {
      const updated = await adjust.mutateAsync(result.data);
      queryClient.setQueryData(['admin', 'product', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      setForm((prev) => ({
        ...prev,
        variants: prev.variants.map((row) => {
          const variant = updated.variants.find((v) => v.id === row.id);
          return variant
            ? {
                ...row,
                stock: String(variant.stockQuantity),
                reservedQuantity: variant.reservedQuantity,
              }
            : row;
        }),
      }));
      setStockOpen(false);
      toast('Estoque ajustado');
    } catch (error) {
      setStockErrors({ _: errorMessage(error) });
    }
  }

  async function confirmArchive() {
    if (!id) return;
    try {
      await archive.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      queryClient.removeQueries({ queryKey: ['admin', 'product', id] });
      toast('Produto arquivado');
      navigate('/admin/produtos');
    } catch (error) {
      setArchiveOpen(false);
      toast(errorMessage(error, 'Não foi possível arquivar o produto'), 'danger');
    }
  }

  // ---------- Imagens ----------

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!id || files.length === 0) return;
    setUpload({ done: 0, total: files.length });
    let failed = 0;
    for (const [index, file] of files.entries()) {
      try {
        const created = await adminApi.uploadImage(id, file);
        setImages((prev) => [...prev, created]);
      } catch (error) {
        failed += 1;
        toast(`Falha ao enviar ${file.name}: ${errorMessage(error)}`, 'danger');
      }
      setUpload({ done: index + 1, total: files.length });
    }
    setUpload(null);
    const sent = files.length - failed;
    if (sent > 0) toast(sent === 1 ? '1 imagem enviada' : `${sent} imagens enviadas`);
    queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    queryClient.invalidateQueries({ queryKey: ['catalog'] });
  }

  async function saveAlt(image: ProductImageData, alt: string) {
    if (!id) return;
    const trimmed = alt.trim();
    if (trimmed === (image.alt ?? '')) return;
    try {
      const updated = await adminApi.updateImage(id, image.id, { alt: trimmed || null });
      setImages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast('Texto alternativo salvo');
    } catch (error) {
      toast(errorMessage(error), 'danger');
    }
  }

  async function moveImage(index: number, direction: -1 | 1) {
    if (!id) return;
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const previous = images;
    const next = [...images];
    const moved = next[index];
    next[index] = next[target];
    next[target] = moved;
    setImages(next);
    try {
      const ordered = await adminApi.reorderImages(
        id,
        next.map((image) => image.id),
      );
      setImages(ordered);
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    } catch (error) {
      setImages(previous);
      toast(errorMessage(error, 'Não foi possível reordenar as imagens'), 'danger');
    }
  }

  async function confirmDeleteImage() {
    if (!id || !imageToDelete) return;
    setDeletingImage(true);
    try {
      await adminApi.deleteImage(id, imageToDelete.id);
      setImages((prev) => prev.filter((image) => image.id !== imageToDelete.id));
      setImageToDelete(null);
      toast('Imagem removida');
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    } catch (error) {
      toast(errorMessage(error, 'Não foi possível remover a imagem'), 'danger');
    } finally {
      setDeletingImage(false);
    }
  }

  // ---------- Estados de carregamento ----------

  const ready = !isEdit || (product !== undefined && loadedFor.current === product.id);
  if (isEdit && productQuery.isError) {
    return (
      <ErrorState
        message={errorMessage(productQuery.error, 'Não foi possível carregar o produto')}
        onRetry={() => productQuery.refetch()}
      />
    );
  }
  if (categoriesQuery.isError || collectionsQuery.isError) {
    return (
      <ErrorState
        message="Não foi possível carregar categorias e coleções."
        onRetry={() => {
          categoriesQuery.refetch();
          collectionsQuery.refetch();
        }}
      />
    );
  }
  if (productQuery.isLoading || categoriesQuery.isLoading || collectionsQuery.isLoading || !ready)
    return <PageLoader />;

  const placeholderKind: CategoryKind = kind ?? 'other';
  const variantsError = errors.variants;

  return (
    <div className="mx-auto max-w-6xl">
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/admin/produtos"
              className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted hover:text-gold"
            >
              <ArrowLeft className="h-3 w-3" /> Produtos
            </Link>
            <h1 className="heading truncate text-2xl">
              {isEdit ? product?.name || 'Editar produto' : 'Novo produto'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {product?.status === 'active' && (
              <LinkButton
                to={`/produto/${product.slug}`}
                external
                variant="ghost"
                size="sm"
                icon={<ExternalLink className="h-4 w-4" />}
              >
                Ver na loja
              </LinkButton>
            )}
            {isEdit && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Boxes className="h-4 w-4" />}
                onClick={openStock}
                data-testid="product-adjust-stock"
              >
                Ajustar estoque
              </Button>
            )}
            {isEdit && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={<Archive className="h-4 w-4" />}
                onClick={() => setArchiveOpen(true)}
                data-testid="product-archive"
              >
                Arquivar
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              icon={<Save className="h-4 w-4" />}
              loading={save.isPending}
              data-testid="product-save"
            >
              Salvar
            </Button>
          </div>
        </div>

        {formError && (
          <Alert tone="danger" className="mb-6">
            {formError}
          </Alert>
        )}

        <div className="space-y-6">
          {/* Informações */}
          <section className="card p-5">
            <h2 className="heading mb-4 text-lg">Informações</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nome"
                name="name"
                required
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                error={errors.name}
                placeholder="Ex.: Submariner Date 41mm"
                data-testid="product-name"
              />
              <Input
                label="Slug (URL)"
                name="slug"
                value={form.slug}
                onChange={(event) => setField('slug', event.target.value)}
                error={errors.slug}
                hint="Opcional. Se vazio, é gerado a partir do nome."
                placeholder="submariner-date-41mm"
              />
              <Input
                label="Marca"
                name="brand"
                value={form.brand}
                onChange={(event) => setField('brand', event.target.value)}
                error={errors.brand}
                placeholder="Ex.: Rolex"
              />
              <Select
                label="Status"
                name="status"
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={(event) => setField('status', event.target.value as ProductStatus)}
                error={errors.status}
                hint="Só produtos publicados aparecem na loja."
              />
              <Select
                label="Categoria"
                name="categoryId"
                required
                options={categories.map((category) => ({
                  value: category.id,
                  label: category.isActive ? category.name : `${category.name} (inativa)`,
                }))}
                placeholder="Selecione a categoria"
                value={form.categoryId}
                onChange={(event) => setCategory(event.target.value)}
                error={errors.categoryId}
                data-testid="product-category"
              />
              <Select
                label="Coleção"
                name="collectionId"
                options={categoryCollections.map((collection) => ({
                  value: collection.id,
                  label: collection.name,
                }))}
                placeholder={form.categoryId ? 'Nenhuma' : 'Escolha a categoria primeiro'}
                value={form.collectionId}
                onChange={(event) => setField('collectionId', event.target.value)}
                error={errors.collectionId}
                disabled={!form.categoryId}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              <Checkbox
                name="isFeatured"
                label="Destaque na home"
                checked={form.isFeatured}
                onChange={(event) => setField('isFeatured', event.target.checked)}
              />
              <Checkbox
                name="isNew"
                label="Novidade"
                checked={form.isNew}
                onChange={(event) => setField('isNew', event.target.checked)}
              />
              <Checkbox
                name="isBestseller"
                label="Mais vendido"
                checked={form.isBestseller}
                onChange={(event) => setField('isBestseller', event.target.checked)}
              />
            </div>
            <div className="mt-4 space-y-4">
              <Textarea
                label="Descrição curta"
                name="shortDescription"
                rows={2}
                className="min-h-16"
                value={form.shortDescription}
                onChange={(event) => setField('shortDescription', event.target.value)}
                error={errors.shortDescription}
                hint={`${form.shortDescription.length}/300 caracteres · aparece nas listagens`}
              />
              <Textarea
                label="Descrição completa"
                name="description"
                rows={8}
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
                error={errors.description}
                hint="História da peça, diferenciais, estado de conservação."
              />
            </div>
          </section>

          {/* Preço */}
          <section className="card p-5">
            <h2 className="heading mb-4 text-lg">Preço</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <MoneyInput
                label="Preço"
                name="priceCents"
                required
                value={form.price}
                onChange={(value) => setField('price', value)}
                error={errors.priceCents}
                data-testid="product-price"
              />
              <MoneyInput
                label='Preço "de" (riscado)'
                name="compareAtPriceCents"
                value={form.compareAtPrice}
                onChange={(value) => setField('compareAtPrice', value)}
                error={errors.compareAtPriceCents}
                hint="Opcional. Exibido riscado quando maior que o preço."
              />
            </div>
          </section>

          {/* Ficha técnica */}
          <section className="card p-5">
            <h2 className="heading mb-1 text-lg">Ficha técnica</h2>
            <p className="mb-4 text-xs text-muted">
              {selectedCategory
                ? `Campos de ${selectedCategory.name.toLowerCase()}. Preencha o que for relevante para a peça.`
                : 'Escolha a categoria para ver os campos da ficha técnica.'}
            </p>
            {selectedCategory && attributeGroups.length === 0 && (
              <p className="text-sm text-muted">
                Esta categoria não possui ficha técnica configurada.
              </p>
            )}
            <div className="space-y-6">
              {attributeGroups.map(([group, fields]) => (
                <fieldset key={group}>
                  <legend className="eyebrow mb-3">{group}</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {fields.map((field) => (
                      <AttributeInput
                        key={field.key}
                        field={field}
                        value={form.attributes[field.key]}
                        onChange={(value) => setAttribute(field.key, value)}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

          {/* Logística */}
          <section className="card p-5">
            <h2 className="heading mb-1 text-lg">Logística</h2>
            <p className="mb-4 text-xs text-muted">
              Peso e dimensões da embalagem, usados no cálculo do frete dos Correios.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Peso (g)"
                name="weightGrams"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.weightGrams}
                onChange={(event) => setField('weightGrams', event.target.value)}
                error={errors.weightGrams}
              />
              <Input
                label="Comprimento (cm)"
                name="lengthCm"
                inputMode="decimal"
                value={form.lengthCm}
                onChange={(event) => setField('lengthCm', event.target.value)}
                error={errors.lengthCm}
              />
              <Input
                label="Largura (cm)"
                name="widthCm"
                inputMode="decimal"
                value={form.widthCm}
                onChange={(event) => setField('widthCm', event.target.value)}
                error={errors.widthCm}
              />
              <Input
                label="Altura (cm)"
                name="heightCm"
                inputMode="decimal"
                value={form.heightCm}
                onChange={(event) => setField('heightCm', event.target.value)}
                error={errors.heightCm}
              />
            </div>
          </section>

          {/* SEO */}
          <section className="card p-5">
            <h2 className="heading mb-4 text-lg">SEO</h2>
            <div className="space-y-4">
              <Input
                label="Título da página"
                name="seoTitle"
                value={form.seoTitle}
                onChange={(event) => setField('seoTitle', event.target.value)}
                error={errors.seoTitle}
                hint={`${form.seoTitle.length}/70 caracteres · se vazio, usa o nome do produto`}
              />
              <Textarea
                label="Meta descrição"
                name="seoDescription"
                rows={3}
                className="min-h-20"
                value={form.seoDescription}
                onChange={(event) => setField('seoDescription', event.target.value)}
                error={errors.seoDescription}
                hint={`${form.seoDescription.length}/160 caracteres`}
              />
            </div>
          </section>

          {/* Variações */}
          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="heading text-lg">Variações</h2>
                <p className="text-xs text-muted">
                  Cada variação tem SKU e estoque próprios. Preço vazio usa o preço do produto.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={addVariant}
                data-testid="variant-add"
              >
                Adicionar variação
              </Button>
            </div>
            {variantsError && (
              <Alert tone="danger" className="mb-4">
                {variantsError}
              </Alert>
            )}
            <div className="overflow-x-auto">
              <table className="table min-w-[1040px]">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Nome</th>
                    <th>Preço próprio</th>
                    <th>Preço &quot;de&quot;</th>
                    <th>Estoque</th>
                    <th>Opção</th>
                    <th>Valor da opção</th>
                    <th className="text-center">Ativa</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {form.variants.map((variant, index) => {
                    const fieldError = (field: string) => errors[`variants.${index}.${field}`];
                    return (
                      <tr key={variant.key}>
                        <td>
                          <CellInput
                            aria-label={`SKU da variação ${index + 1}`}
                            value={variant.sku}
                            onChange={(event) =>
                              setVariant(index, { sku: event.target.value.toUpperCase() })
                            }
                            error={fieldError('sku')}
                            className="font-mono uppercase"
                            placeholder="SKU-001"
                            data-testid="variant-sku"
                          />
                        </td>
                        <td>
                          <CellInput
                            aria-label={`Nome da variação ${index + 1}`}
                            value={variant.name}
                            onChange={(event) => setVariant(index, { name: event.target.value })}
                            error={fieldError('name')}
                            placeholder="Padrão"
                            data-testid="variant-name"
                          />
                        </td>
                        <td>
                          <MoneyInput
                            aria-label={`Preço da variação ${index + 1}`}
                            value={variant.price}
                            onChange={(value) => setVariant(index, { price: value })}
                            error={fieldError('priceCents')}
                            className="min-w-28 py-1.5 text-xs"
                            placeholder="do produto"
                            data-testid="variant-price"
                          />
                        </td>
                        <td>
                          <MoneyInput
                            aria-label={`Preço "de" da variação ${index + 1}`}
                            value={variant.compareAtPrice}
                            onChange={(value) => setVariant(index, { compareAtPrice: value })}
                            error={fieldError('compareAtPriceCents')}
                            className="min-w-28 py-1.5 text-xs"
                            placeholder="—"
                          />
                        </td>
                        <td>
                          <CellInput
                            aria-label={`Estoque da variação ${index + 1}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={variant.stock}
                            onChange={(event) => setVariant(index, { stock: event.target.value })}
                            error={fieldError('stockQuantity')}
                            className="min-w-20"
                            data-testid="variant-stock"
                          />
                          {variant.reservedQuantity > 0 && (
                            <p className="mt-1 text-[11px] text-muted">
                              {variant.reservedQuantity} reservada(s) em pedidos
                            </p>
                          )}
                        </td>
                        <td>
                          <CellInput
                            aria-label={`Nome da opção da variação ${index + 1}`}
                            value={variant.optionKey}
                            onChange={(event) =>
                              setVariant(index, { optionKey: event.target.value })
                            }
                            error={fieldError('optionValues')}
                            placeholder="Ex.: Volume"
                          />
                        </td>
                        <td>
                          <CellInput
                            aria-label={`Valor da opção da variação ${index + 1}`}
                            value={variant.optionValue}
                            onChange={(event) =>
                              setVariant(index, { optionValue: event.target.value })
                            }
                            placeholder="Ex.: 100 ml"
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-gold"
                            aria-label={`Variação ${index + 1} ativa`}
                            checked={variant.isActive}
                            onChange={(event) =>
                              setVariant(index, { isActive: event.target.checked })
                            }
                          />
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="rounded p-1.5 text-ivory/60 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => removeVariant(index)}
                            disabled={form.variants.length <= 1}
                            aria-label={`Remover variação ${index + 1}`}
                            title={
                              form.variants.length <= 1
                                ? 'O produto precisa de pelo menos uma variação'
                                : 'Remover variação'
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
            {isEdit && form.variants.some((variant) => !variant.id) && (
              <p className="mt-3 text-xs text-muted">
                Variações novas passam a existir ao salvar o produto.
              </p>
            )}
          </section>

          {/* Imagens */}
          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="heading text-lg">Imagens</h2>
                <p className="text-xs text-muted">
                  A primeira imagem é a principal. JPG, PNG ou WebP.
                </p>
              </div>
              {isEdit && (
                <label
                  className={`btn-secondary cursor-pointer ${upload ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <ImagePlus className="h-4 w-4" />
                  Enviar imagens
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="sr-only"
                    onChange={handleFiles}
                    disabled={Boolean(upload)}
                    data-testid="product-image-input"
                  />
                </label>
              )}
            </div>
            {!isEdit ? (
              <Alert tone="info">Salve o produto para enviar imagens.</Alert>
            ) : (
              <>
                {upload && (
                  <div className="mb-4" role="status" aria-live="polite">
                    <p className="mb-1.5 text-xs text-muted">
                      Enviando {Math.min(upload.done + 1, upload.total)} de {upload.total}…
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-noir">
                      <div
                        className="h-full bg-gold transition-all"
                        style={{ width: `${Math.round((upload.done / upload.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                {images.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nenhuma imagem enviada. Enquanto isso a loja exibe uma ilustração da categoria.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {images.map((image, index) => (
                      <li key={image.id} className="card overflow-hidden">
                        <div className="relative aspect-square">
                          <ProductImage
                            src={image.url}
                            alt={image.alt ?? ''}
                            kind={placeholderKind}
                            className="absolute inset-0"
                          />
                          {index === 0 && (
                            <span className="absolute left-2 top-2">
                              <Badge tone="gold">Principal</Badge>
                            </span>
                          )}
                        </div>
                        <div className="space-y-2 p-3">
                          <input
                            className="input py-1.5 text-xs"
                            aria-label="Texto alternativo da imagem"
                            placeholder="Texto alternativo (alt)"
                            defaultValue={image.alt ?? ''}
                            onBlur={(event) => saveAlt(image, event.target.value)}
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="rounded p-1.5 text-ivory/70 hover:text-gold disabled:opacity-30"
                                onClick={() => moveImage(index, -1)}
                                disabled={index === 0}
                                aria-label="Mover para cima"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1.5 text-ivory/70 hover:text-gold disabled:opacity-30"
                                onClick={() => moveImage(index, 1)}
                                disabled={index === images.length - 1}
                                aria-label="Mover para baixo"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="rounded p-1.5 text-ivory/60 hover:text-danger"
                              onClick={() => setImageToDelete(image)}
                              aria-label="Remover imagem"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          <LinkButton to="/admin/produtos" variant="ghost">
            Cancelar
          </LinkButton>
          <Button type="submit" icon={<Save className="h-4 w-4" />} loading={save.isPending}>
            Salvar
          </Button>
        </div>
      </form>

      {/* Ajustar estoque */}
      <Modal
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        title="Ajustar estoque"
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStockOpen(false)}
              disabled={adjust.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={submitStock}
              loading={adjust.isPending}
              data-testid="stock-confirm"
            >
              Confirmar ajuste
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {stockErrors._ && <Alert tone="danger">{stockErrors._}</Alert>}
          {savedVariants.length === 0 ? (
            <Alert tone="info">Salve o produto para ajustar o estoque das variações.</Alert>
          ) : (
            <>
              <Select
                label="Variação"
                name="stock-variant"
                options={savedVariants.map((variant) => ({
                  value: variant.id,
                  label: `${variant.name} · ${variant.sku} · estoque ${variant.stock}`,
                }))}
                placeholder="Selecione"
                value={stockForm.variantId}
                onChange={(event) =>
                  setStockForm((prev) => ({ ...prev, variantId: event.target.value }))
                }
                error={stockErrors.variantId}
              />
              <Input
                label="Quantidade (+ entrada / − saída)"
                name="stock-delta"
                type="number"
                step={1}
                inputMode="numeric"
                value={stockForm.delta}
                onChange={(event) =>
                  setStockForm((prev) => ({ ...prev, delta: event.target.value }))
                }
                error={stockErrors.delta}
                hint="Use valores negativos para dar baixa. O estoque não pode ficar abaixo das unidades reservadas."
                placeholder="Ex.: 5 ou -2"
                data-testid="stock-delta"
              />
              <Input
                label="Motivo"
                name="stock-reason"
                value={stockForm.reason}
                onChange={(event) =>
                  setStockForm((prev) => ({ ...prev, reason: event.target.value }))
                }
                error={stockErrors.reason}
                placeholder="Ex.: Recebimento de fornecedor"
                data-testid="stock-reason"
              />
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={confirmArchive}
        title="Arquivar produto"
        text={
          <p>
            O produto <strong className="text-cream">{product?.name}</strong> deixará de aparecer na
            loja e na lista de produtos. Pedidos já realizados não são afetados.
          </p>
        }
        confirmLabel="Arquivar"
        danger
        loading={archive.isPending}
      />

      <ConfirmDialog
        open={Boolean(imageToDelete)}
        onClose={() => setImageToDelete(null)}
        onConfirm={confirmDeleteImage}
        title="Remover imagem"
        text="A imagem será excluída permanentemente do produto."
        confirmLabel="Remover"
        danger
        loading={deletingImage}
      />
    </div>
  );
}
