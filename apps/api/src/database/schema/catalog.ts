import type { ProductAttributes } from '@vellor/shared';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { categoryKindEnum, productStatusEnum } from './enums';
import { users } from './users';

export const categories = pgTable(
  'categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    name: text().notNull(),
    kind: categoryKindEnum().notNull().default('other'),
    description: text(),
    heroImageUrl: text(),
    position: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('categories_slug_idx').on(t.slug)],
);

export const collections = pgTable(
  'collections',
  {
    id: uuid().primaryKey().defaultRandom(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    slug: text().notNull(),
    name: text().notNull(),
    description: text(),
    position: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('collections_category_slug_idx').on(t.categoryId, t.slug)],
);

export const products = pgTable(
  'products',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    name: text().notNull(),
    brand: text(),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    collectionId: uuid().references(() => collections.id, { onDelete: 'set null' }),
    status: productStatusEnum().notNull().default('draft'),
    shortDescription: text(),
    description: text(),
    priceCents: integer().notNull(),
    compareAtPriceCents: integer(),
    isFeatured: boolean().notNull().default(false),
    isNew: boolean().notNull().default(false),
    isBestseller: boolean().notNull().default(false),
    attributes: jsonb().$type<ProductAttributes>().notNull().default({}),
    weightGrams: integer().notNull().default(500),
    lengthCm: real().notNull().default(20),
    widthCm: real().notNull().default(15),
    heightCm: real().notNull().default(10),
    seoTitle: text(),
    seoDescription: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('products_slug_idx').on(t.slug),
    index('products_category_idx').on(t.categoryId),
    index('products_collection_idx').on(t.collectionId),
    index('products_status_idx').on(t.status),
    index('products_created_idx').on(t.createdAt),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid().references((): AnyPgColumn => productVariants.id, { onDelete: 'set null' }),
    storageKey: text().notNull(),
    url: text().notNull(),
    alt: text(),
    mimeType: text().notNull(),
    sizeBytes: integer().notNull().default(0),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('product_images_product_idx').on(t.productId)],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text().notNull(),
    name: text().notNull(),
    priceCents: integer(),
    compareAtPriceCents: integer(),
    stockQuantity: integer().notNull().default(0),
    reservedQuantity: integer().notNull().default(0),
    optionValues: jsonb().$type<Record<string, string>>().notNull().default({}),
    imageId: uuid().references((): AnyPgColumn => productImages.id, { onDelete: 'set null' }),
    position: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('product_variants_sku_idx').on(t.sku),
    index('product_variants_product_idx').on(t.productId),
  ],
);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid().primaryKey().defaultRandom(),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    delta: integer().notNull(),
    reason: text().notNull(),
    referenceType: text(),
    referenceId: text(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('inventory_movements_variant_idx').on(t.variantId)],
);
