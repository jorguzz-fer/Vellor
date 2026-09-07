import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminAuditQuerySchema,
  AdminContactQuerySchema,
  AdminCustomerQuerySchema,
  AdminOrderQuerySchema,
  AdminOrderSchema,
  AuditLogSchema,
  ContactRequestSchema,
  ContactRequestUpdateSchema,
  CouponInputSchema,
  CouponSchema,
  CustomerDetailSchema,
  CustomerSummarySchema,
  DashboardStatsSchema,
  NewsletterSubscriberSchema,
  OrderActionInputSchema,
  OrderSummarySchema,
  PaginationQuerySchema,
  paginatedSchema,
  StoreSettingsSchema,
} from '@vellor/shared';
import { ZodSerializerDto, createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ClientIp, CurrentAuth } from '../../common/decorators';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { OkDto } from '../auth/dto';
import { AdminGuard } from '../auth/guards';
import { CouponsService } from '../checkout/coupons.service';
import { ContactService } from '../contact/contact.service';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { CustomersService } from './customers.service';
import { DashboardService } from './dashboard.service';

class DashboardStatsDto extends createZodDto(DashboardStatsSchema) {}
class AdminOrderQueryDto extends createZodDto(AdminOrderQuerySchema) {}
class PaginatedOrdersDto extends createZodDto(paginatedSchema(OrderSummarySchema)) {}
class AdminOrderDto extends createZodDto(AdminOrderSchema) {}
class OrderActionDto extends createZodDto(OrderActionInputSchema) {}
class CouponDto extends createZodDto(CouponSchema) {}
class CouponListDto extends createZodDto(z.array(CouponSchema)) {}
class CouponInputDto extends createZodDto(CouponInputSchema) {}
class CustomerQueryDto extends createZodDto(AdminCustomerQuerySchema) {}
class PaginatedCustomersDto extends createZodDto(paginatedSchema(CustomerSummarySchema)) {}
class CustomerDetailDto extends createZodDto(CustomerDetailSchema) {}
class ContactQueryDto extends createZodDto(AdminContactQuerySchema) {}
class PaginatedContactsDto extends createZodDto(paginatedSchema(ContactRequestSchema)) {}
class ContactRequestDto extends createZodDto(ContactRequestSchema) {}
class ContactUpdateDto extends createZodDto(ContactRequestUpdateSchema) {}
class PaginationDto extends createZodDto(PaginationQuerySchema) {}
class PaginatedSubscribersDto extends createZodDto(paginatedSchema(NewsletterSubscriberSchema)) {}
class StoreSettingsDto extends createZodDto(StoreSettingsSchema) {}
class AuditQueryDto extends createZodDto(AdminAuditQuerySchema) {}
class PaginatedAuditDto extends createZodDto(paginatedSchema(AuditLogSchema)) {}

@ApiTags('admin')
@ApiCookieAuth()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly orders: OrdersService,
    private readonly coupons: CouponsService,
    private readonly customers: CustomersService,
    private readonly contact: ContactService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Dashboard ----------

  @Get('dashboard')
  @ApiOperation({
    summary: 'Indicadores de vendas, pedidos por status, estoque baixo e atendimento',
  })
  @ApiOkResponse({ type: DashboardStatsDto })
  @ZodSerializerDto(DashboardStatsDto)
  dashboardStats() {
    return this.dashboard.stats();
  }

  // ---------- Pedidos ----------

  @Get('orders')
  @ApiOperation({ summary: 'Lista pedidos com filtros por status, pagamento, período e busca' })
  @ApiOkResponse({ type: PaginatedOrdersDto })
  @ZodSerializerDto(PaginatedOrdersDto)
  listOrders(@Query() query: AdminOrderQueryDto) {
    return this.orders.listAdmin(query);
  }

  @Get('orders/:id')
  @ApiOkResponse({ type: AdminOrderDto })
  @ZodSerializerDto(AdminOrderDto)
  getOrder(@Param('id') id: string) {
    return this.orders.getAdmin(id);
  }

  @Post('orders/:id/actions')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Aplica uma ação ao pedido: confirmar pagamento, separar, enviar (com rastreio), entregar, cancelar, reembolsar, anotar',
  })
  @ApiOkResponse({ type: AdminOrderDto })
  @ZodSerializerDto(AdminOrderDto)
  orderAction(
    @Param('id') id: string,
    @Body() body: OrderActionDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.orders.applyAdminAction(id, body, auth.user, ip);
  }

  // ---------- Cupons ----------

  @Get('coupons')
  @ApiOkResponse({ type: CouponListDto })
  @ZodSerializerDto(CouponListDto)
  listCoupons() {
    return this.coupons.list();
  }

  @Post('coupons')
  @ApiOkResponse({ type: CouponDto })
  @ZodSerializerDto(CouponDto)
  createCoupon(
    @Body() body: CouponInputDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.coupons.create(body, auth.user, ip);
  }

  @Put('coupons/:id')
  @ApiOkResponse({ type: CouponDto })
  @ZodSerializerDto(CouponDto)
  updateCoupon(
    @Param('id') id: string,
    @Body() body: CouponInputDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.coupons.update(id, body, auth.user, ip);
  }

  @Delete('coupons/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Desativa o cupom (mantém histórico de uso)' })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async deleteCoupon(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    await this.coupons.remove(id, auth.user, ip);
    return { ok: true as const };
  }

  // ---------- Clientes ----------

  @Get('customers')
  @ApiOkResponse({ type: PaginatedCustomersDto })
  @ZodSerializerDto(PaginatedCustomersDto)
  listCustomers(@Query() query: CustomerQueryDto) {
    return this.customers.list(query);
  }

  @Get('customers/:id')
  @ApiOkResponse({ type: CustomerDetailDto })
  @ZodSerializerDto(CustomerDetailDto)
  getCustomer(@Param('id') id: string) {
    return this.customers.get(id);
  }

  // ---------- Atendimento e newsletter ----------

  @Get('contact-requests')
  @ApiOkResponse({ type: PaginatedContactsDto })
  @ZodSerializerDto(PaginatedContactsDto)
  listContacts(@Query() query: ContactQueryDto) {
    return this.contact.listContacts(query);
  }

  @Get('contact-requests/:id')
  @ApiOkResponse({ type: ContactRequestDto })
  @ZodSerializerDto(ContactRequestDto)
  getContact(@Param('id') id: string) {
    return this.contact.getContact(id);
  }

  @Patch('contact-requests/:id')
  @ApiOkResponse({ type: ContactRequestDto })
  @ZodSerializerDto(ContactRequestDto)
  updateContact(
    @Param('id') id: string,
    @Body() body: ContactUpdateDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.contact.updateContact(id, body, auth.user, ip);
  }

  @Get('newsletter')
  @ApiOkResponse({ type: PaginatedSubscribersDto })
  @ZodSerializerDto(PaginatedSubscribersDto)
  listSubscribers(@Query() query: PaginationDto) {
    return this.contact.listSubscribers(query);
  }

  @Get('newsletter/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="newsletter.csv"')
  @ApiOperation({ summary: 'Exporta a lista de inscritos em CSV (ação auditada)' })
  exportSubscribers(@CurrentAuth() auth: AuthContext, @ClientIp() ip: string) {
    return this.contact.exportSubscribersCsv(auth.user, ip);
  }

  // ---------- Configurações ----------

  @Get('settings')
  @ApiOkResponse({ type: StoreSettingsDto })
  @ZodSerializerDto(StoreSettingsDto)
  getSettings() {
    return this.settings.get();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Atualiza identidade da loja, frete, parcelamento e textos legais' })
  @ApiOkResponse({ type: StoreSettingsDto })
  @ZodSerializerDto(StoreSettingsDto)
  updateSettings(
    @Body() body: StoreSettingsDto,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    return this.settings.update(body, auth.user, ip);
  }

  // ---------- Auditoria ----------

  @Get('audit-logs')
  @ApiOkResponse({ type: PaginatedAuditDto })
  @ZodSerializerDto(PaginatedAuditDto)
  listAudit(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
