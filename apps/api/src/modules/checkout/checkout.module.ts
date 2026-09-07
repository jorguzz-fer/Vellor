import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { ShippingModule } from '../shipping/shipping.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CouponsService } from './coupons.service';

@Module({
  imports: [CatalogModule, ShippingModule, PaymentsModule, OrdersModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CouponsService],
  exports: [CheckoutService, CouponsService],
})
export class CheckoutModule {}
