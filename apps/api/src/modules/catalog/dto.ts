import {
  AdminProductQuerySchema,
  AdminProductSchema,
  CategoryInputSchema,
  CategorySchema,
  CollectionInputSchema,
  CollectionSchema,
  ImageUpdateInputSchema,
  paginatedSchema,
  ProductDetailSchema,
  ProductImageSchema,
  ProductInputSchema,
  ProductQuerySchema,
  ProductSummarySchema,
  StockAdjustInputSchema,
} from '@vellor/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class ProductQueryDto extends createZodDto(ProductQuerySchema) {}
export class ProductSummaryDto extends createZodDto(ProductSummarySchema) {}
export class ProductDetailDto extends createZodDto(ProductDetailSchema) {}
export class PaginatedProductsDto extends createZodDto(paginatedSchema(ProductSummarySchema)) {}
export class CategoryDto extends createZodDto(CategorySchema) {}
export class CategoryListDto extends createZodDto(z.array(CategorySchema)) {}
export class CollectionDto extends createZodDto(CollectionSchema) {}
export class CollectionListDto extends createZodDto(z.array(CollectionSchema)) {}
export class ProductDetailWithRelatedDto extends createZodDto(
  z.object({ product: ProductDetailSchema, related: z.array(ProductSummarySchema) }),
) {}

export class CollectionQueryDto extends createZodDto(
  z.object({ category: z.string().max(80).optional() }),
) {}

// Admin
export class AdminProductQueryDto extends createZodDto(AdminProductQuerySchema) {}
export class AdminProductDto extends createZodDto(AdminProductSchema) {}
export class PaginatedAdminProductsDto extends createZodDto(paginatedSchema(AdminProductSchema)) {}
export class ProductInputDto extends createZodDto(ProductInputSchema) {}
export class StockAdjustDto extends createZodDto(StockAdjustInputSchema) {}
export class CategoryInputDto extends createZodDto(CategoryInputSchema) {}
export class CollectionInputDto extends createZodDto(CollectionInputSchema) {}
export class ImageUpdateDto extends createZodDto(ImageUpdateInputSchema) {}
export class ProductImageDto extends createZodDto(ProductImageSchema) {}
export class ImageUploadDto extends createZodDto(
  z.object({
    alt: z.string().trim().max(160).optional(),
    variantId: z.uuid().optional(),
  }),
) {}
export class ReorderImagesDto extends createZodDto(
  z.object({ imageIds: z.array(z.uuid()).min(1).max(50) }),
) {}
export class AdminCategoryListDto extends createZodDto(z.array(CategorySchema)) {}
export class AdminCollectionListDto extends createZodDto(z.array(CollectionSchema)) {}
