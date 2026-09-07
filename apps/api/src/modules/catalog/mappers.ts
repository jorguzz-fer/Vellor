import type {
  AdminProduct,
  Category,
  Collection,
  ProductDetail,
  ProductImage,
  ProductSummary,
  ProductVariant,
} from '@vellor/shared';
import type {
  categories,
  collections,
  productImages,
  productVariants,
  products,
} from '../../database/schema';

export type ProductRow = typeof products.$inferSelect;
export type VariantRow = typeof productVariants.$inferSelect;
export type ImageRow = typeof productImages.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type CollectionRow = typeof collections.$inferSelect;

export interface ProductWithRelations extends ProductRow {
  category: CategoryRow;
  collection: CollectionRow | null;
  images: ImageRow[];
  variants: VariantRow[];
}

export function availableQuantity(variant: VariantRow): number {
  return Math.max(0, variant.stockQuantity - variant.reservedQuantity);
}

export function variantPrice(variant: VariantRow, product: ProductRow): number {
  return variant.priceCents ?? product.priceCents;
}

export function toCategory(row: CategoryRow, productCount?: number): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    description: row.description,
    heroImageUrl: row.heroImageUrl,
    position: row.position,
    isActive: row.isActive,
    productCount,
  };
}

export function toCollection(row: CollectionRow, productCount?: number): Collection {
  return {
    id: row.id,
    categoryId: row.categoryId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    position: row.position,
    isActive: row.isActive,
    productCount,
  };
}

export function toImage(row: ImageRow): ProductImage {
  return {
    id: row.id,
    url: row.url,
    alt: row.alt,
    position: row.position,
    variantId: row.variantId,
  };
}

export function toVariant(row: VariantRow, product: ProductRow): ProductVariant {
  const available = availableQuantity(row);
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    priceCents: variantPrice(row, product),
    compareAtPriceCents: row.compareAtPriceCents ?? product.compareAtPriceCents,
    availableQuantity: available,
    inStock: row.isActive && available > 0,
    optionValues: row.optionValues,
    imageId: row.imageId,
    position: row.position,
  };
}

export function toSummary(row: ProductWithRelations): ProductSummary {
  const activeVariants = row.variants.filter((v) => v.isActive);
  const prices = (activeVariants.length ? activeVariants : row.variants).map((v) =>
    variantPrice(v, row),
  );
  const sortedImages = [...row.images].sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    categoryId: row.categoryId,
    categorySlug: row.category.slug,
    categoryName: row.category.name,
    categoryKind: row.category.kind,
    collectionId: row.collectionId,
    collectionSlug: row.collection?.slug ?? null,
    collectionName: row.collection?.name ?? null,
    shortDescription: row.shortDescription,
    priceCents: row.priceCents,
    compareAtPriceCents: row.compareAtPriceCents,
    minPriceCents: prices.length ? Math.min(...prices) : row.priceCents,
    maxPriceCents: prices.length ? Math.max(...prices) : row.priceCents,
    isFeatured: row.isFeatured,
    isNew: row.isNew,
    isBestseller: row.isBestseller,
    inStock: activeVariants.some((v) => availableQuantity(v) > 0),
    primaryImageUrl: sortedImages[0]?.url ?? null,
    attributes: row.attributes ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}

export function toDetail(row: ProductWithRelations): ProductDetail {
  return {
    ...toSummary(row),
    description: row.description,
    images: [...row.images].sort((a, b) => a.position - b.position).map(toImage),
    variants: row.variants
      .filter((v) => v.isActive)
      .sort((a, b) => a.position - b.position)
      .map((v) => toVariant(v, row)),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    weightGrams: row.weightGrams,
  };
}

export function toAdminProduct(row: ProductWithRelations): AdminProduct {
  const detail = toDetail(row);
  return {
    ...detail,
    status: row.status,
    lengthCm: row.lengthCm,
    widthCm: row.widthCm,
    heightCm: row.heightCm,
    variants: [...row.variants]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        ...toVariant(v, row),
        stockQuantity: v.stockQuantity,
        reservedQuantity: v.reservedQuantity,
        isActive: v.isActive,
      })),
    updatedAt: row.updatedAt.toISOString(),
  };
}
