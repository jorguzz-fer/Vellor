import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderSchema } from '@vellor/shared';
import { ZodSerializerDto, createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentAuth } from '../../common/decorators';
import type { AuthContext } from '../auth/auth.types';
import { OrdersService } from './orders.service';

class OrderDto extends createZodDto(OrderSchema) {}
class OrderAccessQueryDto extends createZodDto(
  z.object({ t: z.string().min(10).max(200).optional() }),
) {}
class OrderStatusDto extends createZodDto(
  z.object({
    status: OrderSchema.shape.status,
    statusLabel: z.string(),
    paymentStatus: OrderSchema.shape.payment.shape.status,
    paidAt: z.string().nullable(),
  }),
) {}

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do pedido (dono logado, ou visitante com o token `t`)' })
  @ApiOkResponse({ type: OrderDto })
  @ZodSerializerDto(OrderDto)
  get(
    @Param('id') id: string,
    @Query() query: OrderAccessQueryDto,
    @CurrentAuth() auth?: AuthContext,
  ) {
    return this.orders.getForCustomer(id, auth, query.t);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Status resumido para acompanhamento do pagamento (polling)' })
  @ApiOkResponse({ type: OrderStatusDto })
  @ZodSerializerDto(OrderStatusDto)
  async status(
    @Param('id') id: string,
    @Query() query: OrderAccessQueryDto,
    @CurrentAuth() auth?: AuthContext,
  ) {
    const order = await this.orders.getForCustomer(id, auth, query.t);
    return {
      status: order.status,
      statusLabel: order.statusLabel,
      paymentStatus: order.payment.status,
      paidAt: order.payment.paidAt,
    };
  }
}
