import { Module } from '@nestjs/common';
import { CepController } from './cep.controller';
import { CepService } from './cep.service';
import { CorreiosClient } from './correios.client';
import { ShippingService } from './shipping.service';

@Module({
  controllers: [CepController],
  providers: [ShippingService, CorreiosClient, CepService],
  exports: [ShippingService, CepService],
})
export class ShippingModule {}
