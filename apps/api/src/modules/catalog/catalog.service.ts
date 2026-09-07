import { Injectable } from '@nestjs/common';
import type {
  Category,
  Collection,
  Paginated,
  ProductDetail,
  ProductQuery,
  ProductSummary,
} from '@vellor/shared';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { NotFoundError } from '../../common/errors';
import { type Database, InjectDb } from '../../database/database.module';
import { categories, collections, productVariants, products } from '../../database/schema';
import {
  type ProductWithRelations,
  toCategory,
  toCollection,
  toDetail,
  toSummary,
} from './mappers';

const PUBLIC_RELATIONS = {
  category: true,
  collection: true,
  images: true,
  variants: true,
} as const;

@Injectable()
export class CatalogService {
  constructor(@InjectDb() private readonly db: Database) {}

  private publicProductConditions(): SQL[] {
    return [eq(products.status, 'active'), isNull(products.deletedAt)];
  }

  async listCategories(): Promise<Category[]> {
    const rows = await this.db
      .select({ category: categories, productCount: count(products.id) })
      .from(categories)
      .leftJoin(
        products,
        and(eq(products.categoryId, categories.id), ...this.publicProductConditions()),
      )
      .where(eq(categories.isActive, true))
      .groupBy(categories.id)
      .orderBy(asc(categories.position), asc(categories.name));
    return rows.map((r) => toCategory(r.category, Number(r.productCount)));
  }

  async getCategoryBySlug(slug: string): Promise<Category> {
    const row = await this.db.query.categories.findFirst({
      where: and(eq(categories.slug, slug), eq(categories.isActive, true)),
    });
    if (!row) throw new NotFoundError('Categoria não encontrada', 'category_not_found');
    return toCategory(row);
  }

  async listCollections(categorySlug?: string): Promise<Collection[]> {
    const conditions: SQL[] = [eq(collections.isActive, true)];
    if (categorySlug) {
      const category = await this.db.query.categories.findFirst({
        where: eq(categories.slug, categorySlug),
      });
      if (!category) return [];
      conditions.push(eq(collections.categoryId, category.id));
    }
    const rows = await this.db
      .select({ collection: collections, productCount: count(products.id) })
      .from(collections)
      .leftJoin(
        products,
        and(eq(products.collectionId, collections.id), ...this.publicProductConditions()),
      )
      .where(and(...conditions))
      .groupBy(collections.id)
      .orderBy(asc(collections.position), asc(collections.name));
    return rows.map((r) => toCollection(r.collection, Number(r.productCount)));
  }

  async listProducts(query: ProductQuery): Promise<Paginated<ProductSummary>> {
    const conditions = this.publicProductConditions();

    if (query.category) {
      const category = await this.db.query.categories.findFirst({
        where: eq(categories.slug, query.category),
      });
      if (!category) return this.emptyPage(query);
      conditions.push(eq(products.categoryId, category.id));
    }
    if (query.collection) {
      const collection = await this.db.query.collections.findFirst({
        where: eq(collections.slug, query.collection),
      });
      if (!collection) return this.emptyPage(query);
      conditions.push(eq(products.collectionId, collection.id));
    }
    if (query.q) {
      const term = `%${query.q.replace(/[%_]/g, '\\$&')}%`;
      conditions.push(
        or(
          ilike(products.name, term),
          ilike(products.brand, term),
          ilike(products.shortDescription, term),
        )!,
      );
    }
    if (query.featured) conditions.push(eq(products.isFeatured, true));
    if (query.brand) conditions.push(ilike(products.brand, query.brand));
    if (query.minPriceCents !== undefined)
      conditions.push(gte(products.priceCents, query.minPriceCents));
    if (query.maxPriceCents !== undefined)
      conditions.push(lte(products.priceCents, query.maxPriceCents));

    const where = and(...conditions);
    const orderBy = (() => {
      switch (query.sort) {
        case 'newest':
          return [desc(products.createdAt)];
        case 'price_asc':
          return [asc(products.priceCents), asc(products.name)];
        case 'price_desc':
          return [desc(products.priceCents), asc(products.name)];
        case 'name':
          return [asc(products.name)];
        case 'featured':
        default:
          return [desc(products.isFeatured), desc(products.isBestseller), desc(products.createdAt)];
      }
    })();

    const [{ total }] = await this.db.select({ total: count() }).from(products).where(where);
    const rows = (await this.db.query.products.findMany({
      where,
      with: PUBLIC_RELATIONS,
      orderBy,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    })) as ProductWithRelations[];

    return {
      items: rows.map(toSummary),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / query.pageSize)),
    };
  }

  async getProductBySlug(slug: string): Promise<ProductDetail> {
    const row = (await this.db.query.products.findFirst({
      where: and(eq(products.slug, slug), ...this.publicProductConditions()),
      with: PUBLIC_RELATIONS,
    })) as ProductWithRelations | undefined;
    if (!row) throw new NotFoundError('Produto não encontrado', 'product_not_found');
    return toDetail(row);
  }

  /** Produtos relacionados: mesma coleção ou categoria, excluindo o atual. */
  async relatedProducts(
    productId: string,
    categoryId: string,
    collectionId: string | null,
    limit = 4,
  ): Promise<ProductSummary[]> {
    const base = this.publicProductConditions();
    const rows = (await this.db.query.products.findMany({
      where: and(
        ...base,
        collectionId
          ? eq(products.collectionId, collectionId)
          : eq(products.categoryId, categoryId),
      ),
      with: PUBLIC_RELATIONS,
      orderBy: [desc(products.isFeatured), desc(products.createdAt)],
      limit: limit + 1,
    })) as ProductWithRelations[];
    return rows
      .filter((r) => r.id !== productId)
      .slice(0, limit)
      .map(toSummary);
  }

  /** Variantes ativas (com produto) para cotação e checkout. */
  async findVariantsForCheckout(
    variantIds: string[],
  ): Promise<
    Array<{ variant: typeof productVariants.$inferSelect; product: ProductWithRelations }>
  > {
    if (variantIds.length === 0) return [];
    const variants = await this.db.query.productVariants.findMany({
      where: and(inArray(productVariants.id, variantIds), eq(productVariants.isActive, true)),
    });
    const productIds = [...new Set(variants.map((v) => v.productId))];
    const rows = productIds.length
      ? ((await this.db.query.products.findMany({
          where: and(inArray(products.id, productIds), ...this.publicProductConditions()),
          with: PUBLIC_RELATIONS,
        })) as ProductWithRelations[])
      : [];
    const byId = new Map(rows.map((p) => [p.id, p]));
    return variants
      .map((variant) => ({ variant, product: byId.get(variant.productId)! }))
      .filter((entry) => Boolean(entry.product));
  }

  private emptyPage(query: ProductQuery): Paginated<ProductSummary> {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 1 };
  }
}
