import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicSettingsSchema } from '@vellor/shared';
import { ZodSerializerDto, createZodDto } from 'nestjs-zod';
import { SettingsService } from './settings.service';

class PublicSettingsDto extends createZodDto(PublicSettingsSchema) {}

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Configurações públicas da loja (identidade, frete, parcelamento, textos legais)',
  })
  @ApiOkResponse({ type: PublicSettingsDto })
  @ZodSerializerDto(PublicSettingsDto)
  getPublic() {
    return this.settings.getPublic();
  }
}
