import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { ClientIp, CurrentAuth } from '../../common/decorators';
import { BadRequestError } from '../../common/errors';
import type { AuthContext } from '../auth/auth.types';
import { AdminGuard } from '../auth/guards';
import { OkDto } from '../auth/dto';
import { MAX_IMAGE_BYTES } from '../storage/storage.service';
import { AdminCatalogService } from './admin-catalog.service';
import {
  AdminCategoryListDto,
  AdminCollectionListDto,
  AdminProductDto,
  AdminProductQueryDto,
  CategoryDto,
  CategoryInputDto,
  CollectionDto,
  CollectionInputDto,
  ImageUpdateDto,
  ImageUploadDto,
  PaginatedAdminProductsDto,
  ProductImageDto,
  ProductInputDto,
  ReorderImagesDto,
  StockAdjustDto,
} from './dto';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

class ProductImageListDto extends createZodDto(z.array(ProductImageDto.schema)) {}

@ApiTags('admin')
@ApiCookieAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly service: AdminCatalogService) {}

  // ---------- Produtos ----------

  @Get('products')
  @ApiOperation({ summary: 'Lista produtos (todos os status) com busca e filtro de estoque baixo' })
  @ApiOkResponse({ type: PaginatedAdminProductsDto })
  @ZodSerializerDto(PaginatedAdminProductsDto)
  listProducts(@Query() query: AdminProductQueryDto) {
    return this.service.listProducts(query);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Detalhe administrativo do produto' })
  @ApiOkResponse({ type: AdminProductDto })
  @ZodSerializerDto(AdminProductDto)
  getProduct(@Param('id') id: string) {
    return this.service.getProduct(id);
  }

  @Post('products')
  @ApiOperation({ summary: 'Cria produto com variações e estoque inicial' })
  @ApiOkResponse({ type: AdminProductDto })
  @ZodSerializerDto(AdminProductDto)
  createProduct(
    @Body() body: ProductInputDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.service.createProduct(body, { user: auth.user, ip });
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Atualiza produto e sincroniza variações' })
  @ApiOkResponse({ type: AdminProductDto })
  @ZodSerializerDto(AdminProductDto)
  updateProduct(
    @Param('id') id: string,
    @Body() body: ProductInputDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.service.updateProduct(id, body, { user: auth.user, ip });
  }

  @Delete('products/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Arquiva o produto (soft delete)' })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async deleteProduct(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    await this.service.deleteProduct(id, { user: auth.user, ip });
    return { ok: true as const };
  }

  @Post('stock/adjust')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ajusta o estoque de uma variação com motivo (gera movimentação)' })
  @ApiOkResponse({ type: AdminProductDto })
  @ZodSerializerDto(AdminProductDto)
  adjustStock(
    @Body() body: StockAdjustDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.service.adjustStock(body, { user: auth.user, ip });
  }

  // ---------- Imagens ----------

  @Post('products/:id/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        alt: { type: 'string' },
        variantId: { type: 'string', format: 'uuid' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Envia uma imagem (JPG, PNG, WEBP ou AVIF, até 8 MB)' })
  @ApiOkResponse({ type: ProductImageDto })
  @ZodSerializerDto(ProductImageDto)
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ImageUploadDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    if (!file?.buffer) throw new BadRequestError('Envie o arquivo no campo "file"', 'missing_file');
    return this.service.uploadImage(id, file.buffer, body, { user: auth.user, ip });
  }

  @Patch('products/:id/images/:imageId')
  @ApiOperation({ summary: 'Atualiza texto alternativo, posição ou variação da imagem' })
  @ApiOkResponse({ type: ProductImageDto })
  @ZodSerializerDto(ProductImageDto)
  updateImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() body: ImageUpdateDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.service.updateImage(id, imageId, body, { user: auth.user, ip });
  }

  @Put('products/:id/images/order')
  @ApiOperation({ summary: 'Reordena as imagens do produto' })
  @ApiOkResponse({ type: ProductImageListDto })
  @ZodSerializerDto(ProductImageListDto)
  reorderImages(
    @Param('id') id: string,
    @Body() body: ReorderImagesDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.service.reorderImages(id, body.imageIds, { user: auth.user, ip });
  }

  @Delete('products/:id/images/:imageId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a imagem do produto e do storage' })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    await this.service.deleteImage(id, imageId, { user: auth.user, ip });
    return { ok: true as const };
  }

  // ---------- Categorias ----------

  @Get('categories')
  @ApiOperation({ summary: 'Todas as categorias (ativas e inativas)' })
  @ApiOkResponse({ type: AdminCategoryListDto })
  @ZodSerializerDto(AdminCategoryListDto)
  listCategories() {
    return this.service.listCategories();
  }

  @Post('categories')
  @ApiOkResponse({ type: CategoryDto })
  @ZodSerializerDto(CategoryDto)
  createCategory(
    @Body() body: CategoryInputDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.service.createCategory(body, { user: auth.user, ip });
  }

  @Put('categories/:id')
  @ApiOkResponse({ type: CategoryDto })
  @ZodSerializerDto(CategoryDto)
  updateCategory(
    @Param('id') id: string,
    @Body() body: CategoryInputDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.service.updateCategory(id, body, { user: auth.user, ip });
  }

  @Delete('categories/:id')
  @HttpCode(200)
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async deleteCategory(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    await this.service.deleteCategory(id, { user: auth.user, ip });
    return { ok: true as const };
  }

  // ---------- Coleções ----------

  @Get('collections')
  @ApiOperation({ summary: 'Todas as coleções (ativas e inativas)' })
  @ApiOkResponse({ type: AdminCollectionListDto })
  @ZodSerializerDto(AdminCollectionListDto)
  listCollections() {
    return this.service.listCollections();
  }

  @Post('collections')
  @ApiOkResponse({ type: CollectionDto })
  @ZodSerializerDto(CollectionDto)
  createCollection(
    @Body() body: CollectionInputDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.service.createCollection(body, { user: auth.user, ip });
  }

  @Put('collections/:id')
  @ApiOkResponse({ type: CollectionDto })
  @ZodSerializerDto(CollectionDto)
  updateCollection(
    @Param('id') id: string,
    @Body() body: CollectionInputDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.service.updateCollection(id, body, { user: auth.user, ip });
  }

  @Delete('collections/:id')
  @HttpCode(200)
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async deleteCollection(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    await this.service.deleteCollection(id, { user: auth.user, ip });
    return { ok: true as const };
  }
}
