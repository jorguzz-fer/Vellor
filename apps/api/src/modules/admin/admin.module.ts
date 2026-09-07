import { Module } from '@nestjs/common';
import { CheckoutModule } from '../checkout/checkout.module';
import { ContactModule } from '../contact/contact.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminController } from './admin.controller';
import { CustomersService } from './customers.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [OrdersModule, CheckoutModule, ContactModule],
  controllers: [AdminController],
  providers: [DashboardService, CustomersService],
})
export class AdminModule {}
