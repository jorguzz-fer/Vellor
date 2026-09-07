import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PinoLogger } from 'nestjs-pino';
import { CryptoService } from '../../common/crypto/crypto.service';
import { SkipOriginCheck } from '../../common/decorators';
import { UnauthorizedError } from '../../common/errors';
import { AppConfig } from '../../config/app-config';
import { type Database, InjectDb } from '../../database/database.module';
import { paymentWebhookEvents } from '../../database/schema';
import { OrdersService } from '../orders/orders.service';
import { mapAsaasStatus } from './payments.service';

interface AsaasWebhookBody {
  id?: string;
  event?: string;
  dateCreated?: string;
  payment?: {
    id: string;
    status: string;
    externalReference?: string;
    paymentDate?: string | null;
    confirmedDate?: string | null;
    value?: number;
  };
}

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly config: AppConfig,
    private readonly crypto: CryptoService,
    private readonly orders: OrdersService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WebhookController.name);
  }

  /**
   * Webhook do Asaas. Autenticado pelo token configurado no painel do Asaas
   * (cabeçalho asaas-access-token). Idempotente por id do evento.
   */
  @Post('asaas')
  @HttpCode(200)
  @SkipOriginCheck()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async asaas(@Body() body: AsaasWebhookBody, @Headers('asaas-access-token') token?: string) {
    const expected = this.config.env.ASAAS_WEBHOOK_TOKEN;
    if (!expected || !token || !this.crypto.safeEqual(token, expected)) {
      throw new UnauthorizedError('Token de webhook inválido', 'invalid_webhook_token');
    }
    if (!body?.event || !body.payment?.id) return { received: true, ignored: true };

    const eventId = body.id ?? `${body.event}:${body.payment.id}:${body.dateCreated ?? ''}`;
    const inserted = await this.db
      .insert(paymentWebhookEvents)
      .values({
        provider: 'asaas',
        eventId,
        eventType: body.event,
        providerPaymentId: body.payment.id,
        payload: body as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing()
      .returning({ id: paymentWebhookEvents.id });
    if (inserted.length === 0) return { received: true, duplicate: true };

    try {
      await this.orders.handleProviderEvent({
        providerPaymentId: body.payment.id,
        externalReference: body.payment.externalReference ?? null,
        status: mapAsaasStatus(body.payment.status),
        event: body.event,
        paidAt: body.payment.confirmedDate ?? body.payment.paymentDate ?? null,
      });
      await this.db
        .update(paymentWebhookEvents)
        .set({ processedAt: new Date() })
        .where(eqId(inserted[0]!.id));
    } catch (error) {
      this.logger.error({ err: error, eventId }, 'Falha ao processar webhook do Asaas');
      await this.db
        .update(paymentWebhookEvents)
        .set({ error: error instanceof Error ? error.message : String(error) })
        .where(eqId(inserted[0]!.id));
      throw error;
    }
    return { received: true };
  }
}

import { eq } from 'drizzle-orm';
function eqId(id: string) {
  return eq(paymentWebhookEvents.id, id);
}
