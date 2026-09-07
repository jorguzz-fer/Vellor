import { Module, forwardRef } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AsaasClient } from './asaas.client';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [forwardRef(() => OrdersModule)],
  controllers: [WebhookController, PaymentsController],
  providers: [AsaasClient, PaymentsService],
  exports: [PaymentsService, AsaasClient],
})
export class PaymentsModule {}
