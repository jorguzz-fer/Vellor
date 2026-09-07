import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CATEGORY_KIND_LABELS,
  CATEGORY_KINDS,
  type Category,
  type CategoryInput,
  CategoryInputSchema,
  type CategoryKind,
  type Collection,
  type CollectionInput,
  CollectionInputSchema,
} from '@vellor/shared';
import { LayoutGrid, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  PageLoader,
  useToast,
} from '@/components/ui/feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { adminApi, ApiError } from '@/lib/api';
import { useZodForm } from '@/lib/forms';
import { usePageMeta } from '@/lib/meta';

const KIND_OPTIONS = CATEGORY_KINDS.map((kind) => ({
  value: kind,
  label: CATEGORY_KIND_LABELS[kind],
}));

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

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

// ---------- Modal de categoria ----------

type CategoryFormValues = {
  name: string;
  slug: string;
  kind: CategoryKind;
  description: string;
  heroImageUrl: string;
  position: number;
  isActive: boolean;
};

function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: (created: boolean) => void;
}) {
  const form = useZodForm(CategoryInputSchema, {
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    kind: category?.kind ?? 'watch',
    description: category?.description ?? '',
    heroImageUrl: category?.heroImageUrl ?? '',
    position: category?.position ?? 0,
    isActive: category?.isActive ?? true,
  } satisfies CategoryFormValues);
  const values = form.values as CategoryFormValues;
  const error = (field: keyof CategoryFormValues) => translateZodMessage(form.errors[field]);

  const submit = form.handleSubmit(async (data) => {
    const input: CategoryInput = {
      ...data,
      slug: data.slug?.trim() || undefined,
      description: data.description?.trim() || null,
      heroImageUrl: data.heroImageUrl?.trim() || null,
    };
    if (category) await adminApi.updateCategory(category.id, input);
    else await adminApi.createCategory(input);
    onSaved(!category);
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? 'Editar categoria' : 'Nova categoria'}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="category-form"
            loading={form.submitting}
            data-testid="category-save"
          >
            Salvar
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} noValidate className="space-y-4">
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome"
            name="name"
            required
            value={values.name}
            onChange={(event) => form.setField('name', event.target.value)}
            error={error('name')}
            placeholder="Ex.: Relógios"
            data-testid="category-name"
          />
          <Input
            label="Slug (URL)"
            name="slug"
            value={values.slug}
            onChange={(event) => form.setField('slug', event.target.value)}
            error={error('slug')}
            hint="Opcional. Se vazio, é gerado a partir do nome."
            placeholder="relogios"
          />
          <Select
            label="Tipo"
            name="kind"
            required
            options={KIND_OPTIONS}
            value={values.kind}
            onChange={(event) => form.setField('kind', event.target.value as CategoryKind)}
            error={error('kind')}
            hint="Define os campos da ficha técnica dos produtos."
          />
          <Input
            label="Posição"
            name="position"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={String(values.position)}
            onChange={(event) =>
              form.setField('position', event.target.value === '' ? 0 : Number(event.target.value))
            }
            error={error('position')}
            hint="Ordem de exibição no menu (menor primeiro)."
          />
        </div>
        <Textarea
          label="Descrição"
          name="description"
          rows={3}
          className="min-h-20"
          value={values.description}
          onChange={(event) => form.setField('description', event.target.value)}
          error={error('description')}
          hint={`${values.description.length}/500 caracteres`}
        />
        <Input
          label="Imagem de destaque (URL)"
          name="heroImageUrl"
          type="url"
          value={values.heroImageUrl}
          onChange={(event) => form.setField('heroImageUrl', event.target.value)}
          error={error('heroImageUrl')}
          placeholder="https://…"
        />
        <Checkbox
          name="isActive"
          label="Categoria ativa (visível na loja)"
          checked={values.isActive}
          onChange={(event) => form.setField('isActive', event.target.checked)}
        />
      </form>
    </Modal>
  );
}

// ---------- Modal de coleção ----------

type CollectionFormValues = {
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  position: number;
  isActive: boolean;
};

function CollectionModal({
  collection,
  categories,
  onClose,
  onSaved,
}: {
  collection: Collection | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (created: boolean) => void;
}) {
  const form = useZodForm(CollectionInputSchema, {
    categoryId: collection?.categoryId ?? categories[0]?.id ?? '',
    name: collection?.name ?? '',
    slug: collection?.slug ?? '',
    description: collection?.description ?? '',
    position: collection?.position ?? 0,
    isActive: collection?.isActive ?? true,
  } satisfies CollectionFormValues);
  const values = form.values as CollectionFormValues;
  const error = (field: keyof CollectionFormValues) => translateZodMessage(form.errors[field]);

  const submit = form.handleSubmit(async (data) => {
    const input: CollectionInput = {
      ...data,
      slug: data.slug?.trim() || undefined,
      description: data.description?.trim() || null,
    };
    if (collection) await adminApi.updateCollection(collection.id, input);
    else await adminApi.createCollection(input);
    onSaved(!collection);
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={collection ? 'Editar coleção' : 'Nova coleção'}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={form.submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="collection-form"
            loading={form.submitting}
            data-testid="collection-save"
          >
            Salvar
          </Button>
        </>
      }
    >
      <form id="collection-form" onSubmit={submit} noValidate className="space-y-4">
        {form.formError && <Alert tone="danger">{form.formError}</Alert>}
        <Select
          label="Categoria"
          name="categoryId"
          required
          options={categories.map((category) => ({
            value: category.id,
            label: category.isActive ? category.name : `${category.name} (inativa)`,
          }))}
          placeholder="Selecione a categoria"
          value={values.categoryId}
          onChange={(event) => form.setField('categoryId', event.target.value)}
          error={
            values.categoryId
              ? error('categoryId')
              : form.errors.categoryId
                ? 'Selecione a categoria'
                : undefined
          }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nome"
            name="name"
            required
            value={values.name}
            onChange={(event) => form.setField('name', event.target.value)}
            error={error('name')}
            placeholder="Ex.: Cronógrafos"
            data-testid="collection-name"
          />
          <Input
            label="Slug (URL)"
            name="slug"
            value={values.slug}
            onChange={(event) => form.setField('slug', event.target.value)}
            error={error('slug')}
            hint="Opcional. Se vazio, é gerado a partir do nome."
            placeholder="cronografos"
          />
        </div>
        <Textarea
          label="Descrição"
          name="description"
          rows={3}
          className="min-h-20"
          value={values.description}
          onChange={(event) => form.setField('description', event.target.value)}
          error={error('description')}
          hint={`${values.description.length}/500 caracteres`}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Posição"
            name="position"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={String(values.position)}
            onChange={(event) =>
              form.setField('position', event.target.value === '' ? 0 : Number(event.target.value))
            }
            error={error('position')}
            hint="Ordem dentro da categoria (menor primeiro)."
          />
          <div className="sm:pt-7">
            <Checkbox
              name="isActive"
              label="Coleção ativa (visível na loja)"
              checked={values.isActive}
              onChange={(event) => form.setField('isActive', event.target.checked)}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Página ----------

export default function CategoriesPage() {
  usePageMeta('Categorias e coleções');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: adminApi.categories,
  });
  const collectionsQuery = useQuery({
    queryKey: ['admin', 'collections'],
    queryFn: adminApi.collections,
  });

  const [categoryModal, setCategoryModal] = useState<Category | 'new' | null>(null);
  const [collectionModal, setCollectionModal] = useState<Collection | 'new' | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'collections'] });
    queryClient.invalidateQueries({ queryKey: ['catalog'] });
  }

  const deleteCategory = useMutation({
    mutationFn: (categoryId: string) => adminApi.deleteCategory(categoryId),
    onSuccess: () => {
      invalidate();
      toast('Categoria removida');
      setCategoryToDelete(null);
    },
    onError: (error) => {
      const message = errorMessage(error, 'Não foi possível remover a categoria');
      setDeleteError(message);
      toast(message, 'danger');
    },
  });

  const deleteCollection = useMutation({
    mutationFn: (collectionId: string) => adminApi.deleteCollection(collectionId),
    onSuccess: () => {
      invalidate();
      toast('Coleção removida');
      setCollectionToDelete(null);
    },
    onError: (error) => {
      const message = errorMessage(error, 'Não foi possível remover a coleção');
      setDeleteError(message);
      toast(message, 'danger');
    },
  });

  const categories = categoriesQuery.data ?? [];
  const collections = collectionsQuery.data ?? [];
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Catálogo</p>
          <h1 className="heading text-2xl">Categorias e coleções</h1>
        </div>
      </div>

      {/* Categorias */}
      <section className="card" aria-labelledby="categories-title">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="categories-title" className="heading text-lg">
              Categorias
            </h2>
            <p className="text-xs text-muted">
              O tipo da categoria define a ficha técnica dos produtos.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCategoryModal('new')}
            data-testid="admin-new-category"
          >
            Nova categoria
          </Button>
        </header>
        {categoriesQuery.isLoading ? (
          <PageLoader />
        ) : categoriesQuery.isError ? (
          <div className="p-5">
            <ErrorState
              message={errorMessage(
                categoriesQuery.error,
                'Não foi possível carregar as categorias',
              )}
              onRetry={() => categoriesQuery.refetch()}
            />
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="h-8 w-8" />}
            title="Nenhuma categoria"
            text="Crie a primeira categoria para organizar o catálogo."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Slug</th>
                  <th>Tipo</th>
                  <th className="text-right">Posição</th>
                  <th>Ativa</th>
                  <th className="text-right">Produtos</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} data-testid="admin-category-row">
                    <td className="font-medium text-cream">{category.name}</td>
                    <td className="font-mono text-xs text-muted">{category.slug}</td>
                    <td>{CATEGORY_KIND_LABELS[category.kind]}</td>
                    <td className="text-right">{category.position}</td>
                    <td>
                      <Badge tone={category.isActive ? 'success' : 'muted'}>
                        {category.isActive ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </td>
                    <td className="text-right">{category.productCount ?? 0}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded p-1.5 text-ivory/70 hover:text-gold"
                          onClick={() => setCategoryModal(category)}
                          aria-label={`Editar ${category.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-ivory/70 hover:text-danger"
                          onClick={() => {
                            setDeleteError(null);
                            setCategoryToDelete(category);
                          }}
                          aria-label={`Remover ${category.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Coleções */}
      <section className="card" aria-labelledby="collections-title">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="collections-title" className="heading text-lg">
              Coleções
            </h2>
            <p className="text-xs text-muted">
              Agrupamentos dentro de uma categoria (ex.: cronógrafos, extraits).
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCollectionModal('new')}
            disabled={categories.length === 0}
            title={categories.length === 0 ? 'Crie uma categoria antes' : undefined}
            data-testid="admin-new-collection"
          >
            Nova coleção
          </Button>
        </header>
        {collectionsQuery.isLoading ? (
          <PageLoader />
        ) : collectionsQuery.isError ? (
          <div className="p-5">
            <ErrorState
              message={errorMessage(
                collectionsQuery.error,
                'Não foi possível carregar as coleções',
              )}
              onRetry={() => collectionsQuery.refetch()}
            />
          </div>
        ) : collections.length === 0 ? (
          <EmptyState
            icon={<Tags className="h-8 w-8" />}
            title="Nenhuma coleção"
            text="Coleções são opcionais e ajudam o cliente a navegar dentro de uma categoria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Slug</th>
                  <th className="text-right">Posição</th>
                  <th>Ativa</th>
                  <th className="text-right">Produtos</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => (
                  <tr key={collection.id} data-testid="admin-collection-row">
                    <td className="font-medium text-cream">{collection.name}</td>
                    <td>{categoryNames.get(collection.categoryId) ?? '—'}</td>
                    <td className="font-mono text-xs text-muted">{collection.slug}</td>
                    <td className="text-right">{collection.position}</td>
                    <td>
                      <Badge tone={collection.isActive ? 'success' : 'muted'}>
                        {collection.isActive ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </td>
                    <td className="text-right">{collection.productCount ?? 0}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded p-1.5 text-ivory/70 hover:text-gold"
                          onClick={() => setCollectionModal(collection)}
                          aria-label={`Editar ${collection.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-ivory/70 hover:text-danger"
                          onClick={() => {
                            setDeleteError(null);
                            setCollectionToDelete(collection);
                          }}
                          aria-label={`Remover ${collection.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {categoryModal && (
        <CategoryModal
          category={categoryModal === 'new' ? null : categoryModal}
          onClose={() => setCategoryModal(null)}
          onSaved={(created) => {
            invalidate();
            toast(created ? 'Categoria criada' : 'Categoria salva');
            setCategoryModal(null);
          }}
        />
      )}

      {collectionModal && (
        <CollectionModal
          collection={collectionModal === 'new' ? null : collectionModal}
          categories={categories}
          onClose={() => setCollectionModal(null)}
          onSaved={(created) => {
            invalidate();
            toast(created ? 'Coleção criada' : 'Coleção salva');
            setCollectionModal(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={() => categoryToDelete && deleteCategory.mutate(categoryToDelete.id)}
        title="Remover categoria"
        text={
          <div className="space-y-3">
            <p>
              Remover a categoria <strong className="text-cream">{categoryToDelete?.name}</strong>?
              Só é possível remover categorias sem produtos. Esta ação não pode ser desfeita.
            </p>
            {deleteError && <Alert tone="danger">{deleteError}</Alert>}
          </div>
        }
        confirmLabel="Remover"
        danger
        loading={deleteCategory.isPending}
      />

      <ConfirmDialog
        open={Boolean(collectionToDelete)}
        onClose={() => setCollectionToDelete(null)}
        onConfirm={() => collectionToDelete && deleteCollection.mutate(collectionToDelete.id)}
        title="Remover coleção"
        text={
          <div className="space-y-3">
            <p>
              Remover a coleção <strong className="text-cream">{collectionToDelete?.name}</strong>?
              Os produtos continuam na categoria, apenas sem a coleção.
            </p>
            {deleteError && <Alert tone="danger">{deleteError}</Alert>}
          </div>
        }
        confirmLabel="Remover"
        danger
        loading={deleteCollection.isPending}
      />
    </div>
  );
}
