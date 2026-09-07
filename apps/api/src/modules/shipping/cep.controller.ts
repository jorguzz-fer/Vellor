import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CepLookupSchema } from '@vellor/shared';
import { ZodSerializerDto, createZodDto } from 'nestjs-zod';
import { CepService } from './cep.service';

class CepLookupDto extends createZodDto(CepLookupSchema) {}

@ApiTags('checkout')
@Controller('cep')
export class CepController {
  constructor(private readonly cep: CepService) {}

  @Get(':cep')
  @ApiOperation({
    summary: 'Busca endereço pelo CEP (ViaCEP com cache; resposta parcial se indisponível)',
  })
  @ApiOkResponse({ type: CepLookupDto })
  @ZodSerializerDto(CepLookupDto)
  lookup(@Param('cep') cep: string) {
    return this.cep.lookup(cep);
  }
}
