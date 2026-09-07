import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CartQuoteInputSchema,
  CartQuoteSchema,
  CheckoutInputSchema,
  CheckoutResultSchema,
  ShippingQuoteInputSchema,
  ShippingQuoteSchema,
} from '@vellor/shared';
import { ZodSerializerDto, createZodDto } from 'nestjs-zod';
import { ClientIp, CurrentAuth } from '../../common/decorators';
import type { AuthContext } from '../auth/auth.types';
import { CheckoutService } from './checkout.service';

class CartQuoteInputDto extends createZodDto(CartQuoteInputSchema) {}
class CartQuoteDto extends createZodDto(CartQuoteSchema) {}
class ShippingQuoteInputDto extends createZodDto(ShippingQuoteInputSchema) {}
class ShippingQuoteDto extends createZodDto(ShippingQuoteSchema) {}
class CheckoutInputDto extends createZodDto(CheckoutInputSchema) {}
class CheckoutResultDto extends createZodDto(CheckoutResultSchema) {}

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('quote')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recalcula a sacola no servidor: preços atuais, estoque, cupom, frete e parcelas',
  })
  @ApiOkResponse({ type: CartQuoteDto })
  @ZodSerializerDto(CartQuoteDto)
  quote(@Body() body: CartQuoteInputDto, @CurrentAuth() auth?: AuthContext) {
    return this.checkout.quote(body, auth);
  }

  @Post('shipping-quote')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cotação de frete (Correios com seguro) para um CEP' })
  @ApiOkResponse({ type: ShippingQuoteDto })
  @ZodSerializerDto(ShippingQuoteDto)
  shippingQuote(@Body() body: ShippingQuoteInputDto) {
    return this.checkout.shippingQuote(body);
  }

  @Post('orders')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Cria o pedido, reserva estoque e gera a cobrança (Pix, boleto ou cartão)',
  })
  @ApiOkResponse({ type: CheckoutResultDto })
  @ZodSerializerDto(CheckoutResultDto)
  placeOrder(
    @Body() body: CheckoutInputDto,
    @CurrentAuth() auth: AuthContext | undefined,
    @ClientIp() ip: string,
  ) {
    return this.checkout.placeOrder(body, auth, { ip });
  }
}
