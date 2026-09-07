import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ZodSerializerDto, createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentAuth } from '../../common/decorators';
import { NotFoundError } from '../../common/errors';
import { AppConfig } from '../../config/app-config';
import type { AuthContext } from '../auth/auth.types';
import { OkDto } from '../auth/dto';
import { OrdersService } from '../orders/orders.service';

class MockConfirmDto extends createZodDto(
  z.object({
    orderId: z.uuid(),
    accessToken: z.string().min(10).max(200).optional(),
  }),
) {}

@ApiTags('checkout')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly config: AppConfig,
    private readonly orders: OrdersService,
  ) {}

  /** Só existe em modo simulado: confirma o pagamento de um pedido sem passar pelo Asaas. */
  @Post('mock/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: '[Modo simulado] Confirma o pagamento de um pedido (dev/testes)' })
  @ZodSerializerDto(OkDto)
  async mockConfirm(@Body() body: MockConfirmDto, @CurrentAuth() auth?: AuthContext) {
    if (!this.config.paymentsMock) throw new NotFoundError();
    await this.orders.assertCustomerAccess(body.orderId, auth, body.accessToken);
    await this.orders.markPaid(body.orderId, new Date(), 'mock');
    return { ok: true as const };
  }
}
