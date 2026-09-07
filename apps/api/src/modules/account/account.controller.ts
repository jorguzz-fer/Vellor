import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressSchema, OrderSummarySchema, SaveAddressInputSchema } from '@vellor/shared';
import { ZodSerializerDto, createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentAuth } from '../../common/decorators';
import type { AuthContext } from '../auth/auth.types';
import { OkDto } from '../auth/dto';
import { AuthenticatedGuard } from '../auth/guards';
import { OrdersService } from '../orders/orders.service';
import { AccountService } from './account.service';

class OrderSummaryListDto extends createZodDto(z.array(OrderSummarySchema)) {}
class AddressDto extends createZodDto(AddressSchema) {}
class AddressListDto extends createZodDto(z.array(AddressSchema)) {}
class SaveAddressDto extends createZodDto(SaveAddressInputSchema) {}

@ApiTags('account')
@ApiCookieAuth()
@UseGuards(AuthenticatedGuard)
@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly orders: OrdersService,
  ) {}

  @Get('orders')
  @ApiOperation({ summary: 'Pedidos do cliente logado' })
  @ApiOkResponse({ type: OrderSummaryListDto })
  @ZodSerializerDto(OrderSummaryListDto)
  listOrders(@CurrentAuth() auth: AuthContext) {
    return this.orders.listForUser(auth.user.id);
  }

  @Get('addresses')
  @ApiOkResponse({ type: AddressListDto })
  @ZodSerializerDto(AddressListDto)
  listAddresses(@CurrentAuth() auth: AuthContext) {
    return this.account.listAddresses(auth.user.id);
  }

  @Post('addresses')
  @ApiOkResponse({ type: AddressDto })
  @ZodSerializerDto(AddressDto)
  createAddress(@CurrentAuth() auth: AuthContext, @Body() body: SaveAddressDto) {
    return this.account.createAddress(auth.user.id, body);
  }

  @Put('addresses/:id')
  @ApiOkResponse({ type: AddressDto })
  @ZodSerializerDto(AddressDto)
  updateAddress(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: SaveAddressDto,
  ) {
    return this.account.updateAddress(auth.user.id, id, body);
  }

  @Delete('addresses/:id')
  @HttpCode(200)
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async deleteAddress(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    await this.account.deleteAddress(auth.user.id, id);
    return { ok: true as const };
  }
}
