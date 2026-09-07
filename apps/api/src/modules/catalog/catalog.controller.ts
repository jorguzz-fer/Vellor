import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { CatalogService } from './catalog.service';
import {
  CategoryListDto,
  CollectionListDto,
  CollectionQueryDto,
  PaginatedProductsDto,
  ProductDetailWithRelatedDto,
  ProductQueryDto,
} from './dto';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Categorias ativas com contagem de produtos' })
  @ApiOkResponse({ type: CategoryListDto })
  @ZodSerializerDto(CategoryListDto)
  categories() {
    return this.catalog.listCategories();
  }

  @Get('collections')
  @ApiOperation({ summary: 'Coleções ativas, opcionalmente filtradas por categoria' })
  @ApiOkResponse({ type: CollectionListDto })
  @ZodSerializerDto(CollectionListDto)
  collections(@Query() query: CollectionQueryDto) {
    return this.catalog.listCollections(query.category);
  }

  @Get('products')
  @ApiOperation({ summary: 'Lista paginada de produtos publicados com filtros e ordenação' })
  @ApiOkResponse({ type: PaginatedProductsDto })
  @ZodSerializerDto(PaginatedProductsDto)
  products(@Query() query: ProductQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Detalhe do produto pelo slug, com produtos relacionados' })
  @ApiOkResponse({ type: ProductDetailWithRelatedDto })
  @ZodSerializerDto(ProductDetailWithRelatedDto)
  async product(@Param('slug') slug: string) {
    const product = await this.catalog.getProductBySlug(slug);
    const related = await this.catalog.relatedProducts(
      product.id,
      product.categoryId,
      product.collectionId,
    );
    return { product, related };
  }
}
