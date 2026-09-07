import { Injectable } from '@nestjs/common';
import {
  type AdminProduct,
  type AdminProductQuery,
  type Category,
  type CategoryInput,
  type Collection,
  type CollectionInput,
  type ImageUpdateInput,
  type Paginated,
  type ProductImage,
  type ProductInput,
  slugify,
  type StockAdjustInput,
} from '@vellor/shared';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  like,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { isUniqueViolation } from '../../common/db-errors';
import { ConflictError, NotFoundError, UnprocessableError } from '../../common/errors';
import { type Database, type DbExecutor, InjectDb } from '../../database/database.module';
import {
  categories,
  collections,
  inventoryMovements,
  orderItems,
  productImages,
  productVariants,
  products,
} from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { StorageService } from '../storage/storage.service';
import {
  type ProductWithRelations,
  toAdminProduct,
  toCategory,
  toCollection,
  toImage,
} from './mappers';

const LOW_STOCK_THRESHOLD = 2;
const RELATIONS = { category: true, collection: true, images: true, variants: true } as const;

interface Actor {
  user: AuthUser;
  ip?: string | null;
}

@Injectable()
export class AdminCatalogService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Produtos ----------

  async listProducts(query: AdminProductQuery): Promise<Paginated<AdminProduct>> {
    const conditions: SQL[] = [isNull(products.deletedAt)];
    if (query.status) conditions.push(eq(products.status, query.status));
    if (query.categoryId) conditions.push(eq(products.categoryId, query.categoryId));
    if (query.q) {
      const term = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
      conditions.push(
        or(
          ilike(products.name, term),
          ilike(products.brand, term),
          exists(
            this.db
              .select({ one: sql`1` })
              .from(productVariants)
              .where(
                and(eq(productVariants.productId, products.id), ilike(productVariants.sku, term)),
              ),
          ),
        )!,
      );
    }
    if (query.lowStock) {
      conditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(productVariants)
            .where(
              and(
                eq(productVariants.productId, products.id),
                eq(productVariants.isActive, true),
                sql`${productVariants.stockQuantity} - ${productVariants.reservedQuantity} <= ${LOW_STOCK_THRESHOLD}`,
              ),
            ),
        ),
      );
    }
    const where = and(...conditions);
    const [{ total }] = await this.db.select({ total: count() }).from(products).where(where);
    const rows = (await this.db.query.products.findMany({
      where,
      with: RELATIONS,
      orderBy: [desc(products.updatedAt)],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })) as ProductWithRelations[];
    return {
      items: rows.map(toAdminProduct),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / query.pageSize)),
    };
  }

  async getProduct(id: string, executor: DbExecutor = this.db): Promise<AdminProduct> {
    const row = (await executor.query.products.findFirst({
      where: and(eq(products.id, id), isNull(products.deletedAt)),
      with: RELATIONS,
    })) as ProductWithRelations | undefined;
    if (!row) throw new NotFoundError('Produto não encontrado', 'product_not_found');
    return toAdminProduct(row);
  }

  private async uniqueSlug(
    executor: DbExecutor,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    const candidate = slugify(base) || 'produto';
    const rows = await executor
      .select({ slug: products.slug, id: products.id })
      .from(products)
      .where(or(eq(products.slug, candidate), like(products.slug, `${candidate}-%`)));
    const taken = new Set(rows.filter((r) => r.id !== excludeId).map((r) => r.slug));
    if (!taken.has(candidate)) return candidate;
    let n = 2;
    while (taken.has(`${candidate}-${n}`)) n++;
    return `${candidate}-${n}`;
  }

  private async assertCategory(
    executor: DbExecutor,
    categoryId: string,
    collectionId?: string | null,
  ): Promise<void> {
    const category = await executor.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });
    if (!category)
      throw new UnprocessableError('Categoria inválida', 'invalid_category', {
        categoryId: ['Categoria não encontrada'],
      });
    if (collectionId) {
      const collection = await executor.query.collections.findFirst({
        where: eq(collections.id, collectionId),
      });
      if (!collection || collection.categoryId !== categoryId) {
        throw new UnprocessableError(
          'A coleção não pertence à categoria escolhida',
          'invalid_collection',
          {
            collectionId: ['Coleção inválida para esta categoria'],
          },
        );
      }
    }
  }

  private productColumns(input: ProductInput) {
    return {
      name: input.name,
      brand: input.brand ?? null,
      categoryId: input.categoryId,
      collectionId: input.collectionId ?? null,
      status: input.status,
      shortDescription: input.shortDescription ?? null,
      description: input.description ?? null,
      priceCents: input.priceCents,
      compareAtPriceCents: input.compareAtPriceCents ?? null,
      isFeatured: input.isFeatured,
      isNew: input.isNew,
      isBestseller: input.isBestseller,
      attributes: input.attributes,
      weightGrams: input.weightGrams,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      updatedAt: new Date(),
    };
  }

  async createProduct(input: ProductInput, actor: Actor): Promise<AdminProduct> {
    const skus = input.variants.map((v) => v.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length)
      throw new UnprocessableError('SKUs repetidos no mesmo produto', 'duplicate_sku');

    const id = await this.db.transaction(async (tx) => {
      await this.assertCategory(tx, input.categoryId, input.collectionId);
      const slug = await this.uniqueSlug(tx, input.slug || input.name);
      let productId: string;
      try {
        const [row] = await tx
          .insert(products)
          .values({ ...this.productColumns(input), slug })
          .returning({ id: products.id });
        productId = row!.id;
        for (const [index, variant] of input.variants.entries()) {
          const [created] = await tx
            .insert(productVariants)
            .values({
              productId,
              sku: variant.sku.trim().toUpperCase(),
              name: variant.name,
              priceCents: variant.priceCents ?? null,
              compareAtPriceCents: variant.compareAtPriceCents ?? null,
              stockQuantity: variant.stockQuantity,
              optionValues: variant.optionValues,
              position: variant.position ?? index,
              isActive: variant.isActive,
            })
            .returning({ id: productVariants.id });
          if (variant.stockQuantity > 0) {
            await tx.insert(inventoryMovements).values({
              variantId: created!.id,
              delta: variant.stockQuantity,
              reason: 'Estoque inicial',
              referenceType: 'product_create',
              referenceId: productId,
              actorId: actor.user.id,
            });
          }
        }
      } catch (error) {
        if (isUniqueViolation(error, 'sku'))
          throw new ConflictError('Já existe uma variação com este SKU', 'sku_in_use');
        throw error;
      }
      await this.audit.record(
        {
          actor: actor.user,
          action: 'product.create',
          entity: 'product',
          entityId: productId,
          summary: `Produto criado: ${input.name}`,
          ip: actor.ip,
        },
        tx,
      );
      return productId;
    });
    return this.getProduct(id);
  }

  async updateProduct(id: string, input: ProductInput, actor: Actor): Promise<AdminProduct> {
    const skus = input.variants.map((v) => v.sku.trim().toUpperCase());
    if (new Set(skus).size !== skus.length)
      throw new UnprocessableError('SKUs repetidos no mesmo produto', 'duplicate_sku');

    await this.db.transaction(async (tx) => {
      const existing = await tx.query.products.findFirst({
        where: and(eq(products.id, id), isNull(products.deletedAt)),
        with: { variants: true },
      });
      if (!existing) throw new NotFoundError('Produto não encontrado', 'product_not_found');
      await this.assertCategory(tx, input.categoryId, input.collectionId);
      const slug =
        input.slug && slugify(input.slug) !== existing.slug
          ? await this.uniqueSlug(tx, input.slug, id)
          : existing.slug;

      try {
        await tx
          .update(products)
          .set({ ...this.productColumns(input), slug })
          .where(eq(products.id, id));

        const existingById = new Map(existing.variants.map((v) => [v.id, v]));
        const keptIds = new Set<string>();
        for (const [index, variant] of input.variants.entries()) {
          const sku = variant.sku.trim().toUpperCase();
          const current = variant.id ? existingById.get(variant.id) : undefined;
          if (current) {
            keptIds.add(current.id);
            await tx
              .update(productVariants)
              .set({
                sku,
                name: variant.name,
                priceCents: variant.priceCents ?? null,
                compareAtPriceCents: variant.compareAtPriceCents ?? null,
                stockQuantity: variant.stockQuantity,
                optionValues: variant.optionValues,
                imageId: variant.imageId ?? null,
                position: variant.position ?? index,
                isActive: variant.isActive,
                updatedAt: new Date(),
              })
              .where(eq(productVariants.id, current.id));
            const delta = variant.stockQuantity - current.stockQuantity;
            if (delta !== 0) {
              if (variant.stockQuantity < current.reservedQuantity) {
                throw new UnprocessableError(
                  `A variação ${sku} tem ${current.reservedQuantity} unidade(s) reservada(s) em pedidos pendentes`,
                  'stock_below_reserved',
                );
              }
              await tx.insert(inventoryMovements).values({
                variantId: current.id,
                delta,
                reason: 'Ajuste no cadastro do produto',
                referenceType: 'product_update',
                referenceId: id,
                actorId: actor.user.id,
              });
            }
          } else {
            const [created] = await tx
              .insert(productVariants)
              .values({
                productId: id,
                sku,
                name: variant.name,
                priceCents: variant.priceCents ?? null,
                compareAtPriceCents: variant.compareAtPriceCents ?? null,
                stockQuantity: variant.stockQuantity,
                optionValues: variant.optionValues,
                imageId: variant.imageId ?? null,
                position: variant.position ?? index,
                isActive: variant.isActive,
              })
              .returning({ id: productVariants.id });
            keptIds.add(created!.id);
            if (variant.stockQuantity > 0) {
              await tx.insert(inventoryMovements).values({
                variantId: created!.id,
                delta: variant.stockQuantity,
                reason: 'Estoque inicial da variação',
                referenceType: 'product_update',
                referenceId: id,
                actorId: actor.user.id,
              });
            }
          }
        }

        const removed = existing.variants.filter((v) => !keptIds.has(v.id));
        for (const variant of removed) {
          if (variant.reservedQuantity > 0) {
            throw new UnprocessableError(
              `A variação ${variant.sku} tem unidades reservadas em pedidos pendentes e não pode ser removida`,
              'variant_reserved',
            );
          }
          const [ref] = await tx
            .select({ n: count() })
            .from(orderItems)
            .where(eq(orderItems.variantId, variant.id));
          if (Number(ref?.n ?? 0) > 0) {
            await tx
              .update(productVariants)
              .set({ isActive: false, updatedAt: new Date() })
              .where(eq(productVariants.id, variant.id));
          } else {
            await tx.delete(productVariants).where(eq(productVariants.id, variant.id));
          }
        }
      } catch (error) {
        if (isUniqueViolation(error, 'sku'))
          throw new ConflictError('Já existe uma variação com este SKU', 'sku_in_use');
        throw error;
      }

      await this.audit.record(
        {
          actor: actor.user,
          action: 'product.update',
          entity: 'product',
          entityId: id,
          summary: `Produto atualizado: ${input.name}`,
          ip: actor.ip,
        },
        tx,
      );
    });
    return this.getProduct(id);
  }

  async deleteProduct(id: string, actor: Actor): Promise<void> {
    const [row] = await this.db
      .update(products)
      .set({ deletedAt: new Date(), status: 'archived', updatedAt: new Date() })
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning({ id: products.id, name: products.name });
    if (!row) throw new NotFoundError('Produto não encontrado', 'product_not_found');
    await this.audit.record({
      actor: actor.user,
      action: 'product.delete',
      entity: 'product',
      entityId: id,
      summary: `Produto arquivado: ${row.name}`,
      ip: actor.ip,
    });
  }

  async adjustStock(input: StockAdjustInput, actor: Actor): Promise<AdminProduct> {
    const productId = await this.db.transaction(async (tx) => {
      const [variant] = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, input.variantId))
        .for('update');
      if (!variant) throw new NotFoundError('Variação não encontrada', 'variant_not_found');
      const next = variant.stockQuantity + input.delta;
      if (next < variant.reservedQuantity) {
        throw new UnprocessableError(
          `Estoque não pode ficar abaixo das ${variant.reservedQuantity} unidade(s) reservada(s)`,
          'stock_below_reserved',
        );
      }
      await tx
        .update(productVariants)
        .set({ stockQuantity: next, updatedAt: new Date() })
        .where(eq(productVariants.id, variant.id));
      await tx.insert(inventoryMovements).values({
        variantId: variant.id,
        delta: input.delta,
        reason: input.reason,
        referenceType: 'manual',
        actorId: actor.user.id,
      });
      await this.audit.record(
        {
          actor: actor.user,
          action: 'stock.adjust',
          entity: 'product_variant',
          entityId: variant.id,
          summary: `Estoque ${input.delta > 0 ? '+' : ''}${input.delta} (${variant.sku}): ${input.reason}`,
          ip: actor.ip,
        },
        tx,
      );
      return variant.productId;
    });
    return this.getProduct(productId);
  }

  // ---------- Imagens ----------

  async uploadImage(
    productId: string,
    buffer: Buffer,
    meta: { alt?: string; variantId?: string },
    actor: Actor,
  ): Promise<ProductImage> {
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.id, productId), isNull(products.deletedAt)),
    });
    if (!product) throw new NotFoundError('Produto não encontrado', 'product_not_found');
    if (meta.variantId) {
      const variant = await this.db.query.productVariants.findFirst({
        where: and(
          eq(productVariants.id, meta.variantId),
          eq(productVariants.productId, productId),
        ),
      });
      if (!variant)
        throw new UnprocessableError('Variação inválida para este produto', 'invalid_variant');
    }
    const stored = await this.storage.putImage(buffer, `products/${productId}`);
    const [{ maxPosition }] = await this.db
      .select({ maxPosition: sql<number>`coalesce(max(${productImages.position}), -1)` })
      .from(productImages)
      .where(eq(productImages.productId, productId));
    const [row] = await this.db
      .insert(productImages)
      .values({
        productId,
        variantId: meta.variantId ?? null,
        storageKey: stored.key,
        url: stored.url,
        alt: meta.alt ?? product.name,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        position: Number(maxPosition) + 1,
      })
      .returning();
    await this.audit.record({
      actor: actor.user,
      action: 'product.image_upload',
      entity: 'product',
      entityId: productId,
      summary: `Imagem adicionada (${stored.key})`,
      ip: actor.ip,
    });
    return toImage(row!);
  }

  async updateImage(
    productId: string,
    imageId: string,
    input: ImageUpdateInput,
    actor: Actor,
  ): Promise<ProductImage> {
    const [row] = await this.db
      .update(productImages)
      .set({
        ...(input.alt !== undefined ? { alt: input.alt } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.variantId !== undefined ? { variantId: input.variantId } : {}),
      })
      .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
      .returning();
    if (!row) throw new NotFoundError('Imagem não encontrada', 'image_not_found');
    await this.audit.record({
      actor: actor.user,
      action: 'product.image_update',
      entity: 'product',
      entityId: productId,
      ip: actor.ip,
    });
    return toImage(row);
  }

  async reorderImages(
    productId: string,
    imageIds: string[],
    actor: Actor,
  ): Promise<ProductImage[]> {
    await this.db.transaction(async (tx) => {
      for (const [position, imageId] of imageIds.entries()) {
        await tx
          .update(productImages)
          .set({ position })
          .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)));
      }
    });
    await this.audit.record({
      actor: actor.user,
      action: 'product.image_reorder',
      entity: 'product',
      entityId: productId,
      ip: actor.ip,
    });
    const rows = await this.db.query.productImages.findMany({
      where: eq(productImages.productId, productId),
      orderBy: [asc(productImages.position)],
    });
    return rows.map(toImage);
  }

  async deleteImage(productId: string, imageId: string, actor: Actor): Promise<void> {
    const [row] = await this.db
      .delete(productImages)
      .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
      .returning();
    if (!row) throw new NotFoundError('Imagem não encontrada', 'image_not_found');
    await this.storage.delete(row.storageKey);
    await this.audit.record({
      actor: actor.user,
      action: 'product.image_delete',
      entity: 'product',
      entityId: productId,
      summary: `Imagem removida (${row.storageKey})`,
      ip: actor.ip,
    });
  }

  // ---------- Categorias e coleções ----------

  async listCategories(): Promise<Category[]> {
    const rows = await this.db
      .select({ category: categories, productCount: count(products.id) })
      .from(categories)
      .leftJoin(products, and(eq(products.categoryId, categories.id), isNull(products.deletedAt)))
      .groupBy(categories.id)
      .orderBy(asc(categories.position), asc(categories.name));
    return rows.map((r) => toCategory(r.category, Number(r.productCount)));
  }

  async createCategory(input: CategoryInput, actor: Actor): Promise<Category> {
    const slug = slugify(input.slug || input.name);
    try {
      const [row] = await this.db
        .insert(categories)
        .values({
          ...input,
          slug,
          description: input.description ?? null,
          heroImageUrl: input.heroImageUrl ?? null,
        })
        .returning();
      await this.audit.record({
        actor: actor.user,
        action: 'category.create',
        entity: 'category',
        entityId: row!.id,
        summary: input.name,
        ip: actor.ip,
      });
      return toCategory(row!);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictError('Já existe uma categoria com este slug', 'slug_in_use');
      throw error;
    }
  }

  async updateCategory(id: string, input: CategoryInput, actor: Actor): Promise<Category> {
    const slug = slugify(input.slug || input.name);
    try {
      const [row] = await this.db
        .update(categories)
        .set({
          ...input,
          slug,
          description: input.description ?? null,
          heroImageUrl: input.heroImageUrl ?? null,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, id))
        .returning();
      if (!row) throw new NotFoundError('Categoria não encontrada', 'category_not_found');
      await this.audit.record({
        actor: actor.user,
        action: 'category.update',
        entity: 'category',
        entityId: id,
        summary: input.name,
        ip: actor.ip,
      });
      return toCategory(row);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictError('Já existe uma categoria com este slug', 'slug_in_use');
      throw error;
    }
  }

  async deleteCategory(id: string, actor: Actor): Promise<void> {
    const [{ n }] = await this.db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.categoryId, id), isNull(products.deletedAt)));
    if (Number(n) > 0)
      throw new ConflictError(
        'Mova ou arquive os produtos desta categoria antes de removê-la',
        'category_in_use',
      );
    const [row] = await this.db.delete(categories).where(eq(categories.id, id)).returning();
    if (!row) throw new NotFoundError('Categoria não encontrada', 'category_not_found');
    await this.audit.record({
      actor: actor.user,
      action: 'category.delete',
      entity: 'category',
      entityId: id,
      summary: row.name,
      ip: actor.ip,
    });
  }

  async listCollections(): Promise<Collection[]> {
    const rows = await this.db
      .select({ collection: collections, productCount: count(products.id) })
      .from(collections)
      .leftJoin(
        products,
        and(eq(products.collectionId, collections.id), isNull(products.deletedAt)),
      )
      .groupBy(collections.id)
      .orderBy(asc(collections.position), asc(collections.name));
    return rows.map((r) => toCollection(r.collection, Number(r.productCount)));
  }

  async createCollection(input: CollectionInput, actor: Actor): Promise<Collection> {
    await this.assertCategory(this.db, input.categoryId);
    const slug = slugify(input.slug || input.name);
    try {
      const [row] = await this.db
        .insert(collections)
        .values({ ...input, slug, description: input.description ?? null })
        .returning();
      await this.audit.record({
        actor: actor.user,
        action: 'collection.create',
        entity: 'collection',
        entityId: row!.id,
        summary: input.name,
        ip: actor.ip,
      });
      return toCollection(row!);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictError(
          'Já existe uma coleção com este slug nesta categoria',
          'slug_in_use',
        );
      throw error;
    }
  }

  async updateCollection(id: string, input: CollectionInput, actor: Actor): Promise<Collection> {
    await this.assertCategory(this.db, input.categoryId);
    const slug = slugify(input.slug || input.name);
    try {
      const [row] = await this.db
        .update(collections)
        .set({ ...input, slug, description: input.description ?? null, updatedAt: new Date() })
        .where(eq(collections.id, id))
        .returning();
      if (!row) throw new NotFoundError('Coleção não encontrada', 'collection_not_found');
      await this.audit.record({
        actor: actor.user,
        action: 'collection.update',
        entity: 'collection',
        entityId: id,
        summary: input.name,
        ip: actor.ip,
      });
      return toCollection(row);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictError(
          'Já existe uma coleção com este slug nesta categoria',
          'slug_in_use',
        );
      throw error;
    }
  }

  async deleteCollection(id: string, actor: Actor): Promise<void> {
    const [row] = await this.db.delete(collections).where(eq(collections.id, id)).returning();
    if (!row) throw new NotFoundError('Coleção não encontrada', 'collection_not_found');
    await this.audit.record({
      actor: actor.user,
      action: 'collection.delete',
      entity: 'collection',
      entityId: id,
      summary: row.name,
      ip: actor.ip,
    });
  }

  async productsInVariantIds(variantIds: string[]): Promise<Set<string>> {
    if (!variantIds.length) return new Set();
    const rows = await this.db
      .select({ productId: productVariants.productId })
      .from(productVariants)
      .where(inArray(productVariants.id, variantIds));
    return new Set(rows.map((r) => r.productId));
  }
}
