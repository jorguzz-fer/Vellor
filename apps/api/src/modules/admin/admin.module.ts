import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { ContactModule } from '../contact/contact.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminController } from './admin.controller';
import { CustomersService } from './customers.service';
import { DashboardService } from './dashboard.service';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [AuthModule, OrdersModule, CheckoutModule, ContactModule],
  controllers: [AdminController, TeamController],
  providers: [DashboardService, CustomersService, TeamService],
})
export class AdminModule {}
