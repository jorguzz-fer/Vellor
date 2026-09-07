import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [OrdersModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
