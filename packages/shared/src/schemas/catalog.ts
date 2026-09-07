import { z } from 'zod';
import { CATEGORY_KINDS, PRODUCT_STATUSES } from '../enums.js';
import { PaginationQuerySchema } from './common.js';

export const CategorySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  kind: z.enum(CATEGORY_KINDS),
  description: z.string().nullable(),
  heroImageUrl: z.string().nullable(),
  position: z.number().int(),
  isActive: z.boolean(),
  productCount: z.number().int().optional(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CollectionSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  isActive: z.boolean(),
  productCount: z.number().int().optional(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export const ProductImageSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  alt: z.string().nullable(),
  position: z.number().int(),
  variantId: z.uuid().nullable(),
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const ProductVariantSchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  name: z.string(),
  priceCents: z.number().int(),
  compareAtPriceCents: z.number().int().nullable(),
  availableQuantity: z.number().int(),
  inStock: z.boolean(),
  optionValues: z.record(z.string(), z.string()),
  imageId: z.uuid().nullable(),
  position: z.number().int(),
});
export type ProductVariant = z.infer<typeof ProductVariantSchema>;

export const ProductSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  brand: z.string().nullable(),
  categoryId: z.uuid(),
  categorySlug: z.string(),
  categoryName: z.string(),
  categoryKind: z.enum(CATEGORY_KINDS),
  collectionId: z.uuid().nullable(),
  collectionSlug: z.string().nullable(),
  collectionName: z.string().nullable(),
  shortDescription: z.string().nullable(),
  priceCents: z.number().int(),
  compareAtPriceCents: z.number().int().nullable(),
  /** Menor preço entre as variantes (para "a partir de"). */
  minPriceCents: z.number().int(),
  maxPriceCents: z.number().int(),
  isFeatured: z.boolean(),
  isNew: z.boolean(),
  isBestseller: z.boolean(),
  inStock: z.boolean(),
  primaryImageUrl: z.string().nullable(),
  attributes: z.record(z.string(), z.union([z.string(), z.number()])),
  createdAt: z.string(),
});
export type ProductSummary = z.infer<typeof ProductSummarySchema>;

export const ProductDetailSchema = ProductSummarySchema.extend({
  description: z.string().nullable(),
  images: z.array(ProductImageSchema),
  variants: z.array(ProductVariantSchema),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  weightGrams: z.number().int(),
});
export type ProductDetail = z.infer<typeof ProductDetailSchema>;

export const PRODUCT_SORTS = ['featured', 'newest', 'price_asc', 'price_desc', 'name'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  featured: 'Destaques',
  newest: 'Novidades',
  price_asc: 'Menor preço',
  price_desc: 'Maior preço',
  name: 'Nome (A-Z)',
};

export const ProductQuerySchema = PaginationQuerySchema.extend({
  category: z.string().max(80).optional(),
  collection: z.string().max(80).optional(),
  q: z.string().trim().max(80).optional(),
  sort: z.enum(PRODUCT_SORTS).default('featured'),
  featured: z.stringbool().optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  brand: z.string().max(80).optional(),
});
export type ProductQuery = z.infer<typeof ProductQuerySchema>;

// ---------- Admin ----------

export const VariantInputSchema = z.object({
  id: z.uuid().optional(),
  sku: z.string().trim().min(1, 'Informe o SKU').max(64),
  name: z.string().trim().min(1).max(120),
  priceCents: z.number().int().min(0).nullable().optional(),
  compareAtPriceCents: z.number().int().min(0).nullable().optional(),
  stockQuantity: z.number().int().min(0).default(0),
  optionValues: z.record(z.string(), z.string()).default({}),
  imageId: z.uuid().nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type VariantInput = z.infer<typeof VariantInputSchema>;

export const ProductInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(160),
  slug: z.string().trim().max(160).optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  categoryId: z.uuid('Selecione a categoria'),
  collectionId: z.uuid().nullable().optional(),
  status: z.enum(PRODUCT_STATUSES).default('draft'),
  shortDescription: z.string().trim().max(300).nullable().optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  priceCents: z.number().int().min(0, 'Preço inválido'),
  compareAtPriceCents: z.number().int().min(0).nullable().optional(),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isBestseller: z.boolean().default(false),
  attributes: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  weightGrams: z.number().int().min(1).default(500),
  lengthCm: z.number().min(1).max(100).default(20),
  widthCm: z.number().min(1).max(100).default(15),
  heightCm: z.number().min(1).max(100).default(10),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(160).nullable().optional(),
  variants: z.array(VariantInputSchema).min(1, 'Cadastre pelo menos uma variação').max(30),
});
export type ProductInput = z.infer<typeof ProductInputSchema>;

export const AdminProductQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  categoryId: z.uuid().optional(),
  lowStock: z.stringbool().optional(),
});
export type AdminProductQuery = z.infer<typeof AdminProductQuerySchema>;

export const AdminVariantSchema = ProductVariantSchema.extend({
  stockQuantity: z.number().int(),
  reservedQuantity: z.number().int(),
  isActive: z.boolean(),
});

export const AdminProductSchema = ProductDetailSchema.extend({
  status: z.enum(PRODUCT_STATUSES),
  lengthCm: z.number(),
  widthCm: z.number(),
  heightCm: z.number(),
  variants: z.array(AdminVariantSchema),
  updatedAt: z.string(),
});
export type AdminProduct = z.infer<typeof AdminProductSchema>;

export const StockAdjustInputSchema = z.object({
  variantId: z.uuid(),
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, 'Informe uma quantidade diferente de zero'),
  reason: z.string().trim().min(3).max(200),
});
export type StockAdjustInput = z.infer<typeof StockAdjustInputSchema>;

export const CategoryInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  kind: z.enum(CATEGORY_KINDS),
  description: z.string().trim().max(500).nullable().optional(),
  heroImageUrl: z.string().max(500).nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof CategoryInputSchema>;

export const CollectionInputSchema = z.object({
  categoryId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type CollectionInput = z.infer<typeof CollectionInputSchema>;

export const ImageUpdateInputSchema = z.object({
  alt: z.string().trim().max(160).nullable().optional(),
  position: z.number().int().min(0).optional(),
  variantId: z.uuid().nullable().optional(),
});
export type ImageUpdateInput = z.infer<typeof ImageUpdateInputSchema>;
