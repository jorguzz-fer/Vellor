import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactInputSchema, NewsletterInputSchema } from '@vellor/shared';
import { ZodSerializerDto, createZodDto } from 'nestjs-zod';
import { CurrentAuth } from '../../common/decorators';
import type { AuthContext } from '../auth/auth.types';
import { OkDto } from '../auth/dto';
import { ContactService } from './contact.service';

class ContactDto extends createZodDto(ContactInputSchema) {}
class NewsletterDto extends createZodDto(NewsletterInputSchema) {}

@ApiTags('contact')
@Controller()
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post('contact')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Envia mensagem para o atendimento' })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async send(@Body() body: ContactDto, @CurrentAuth() auth?: AuthContext) {
    await this.contact.createContact(body, auth);
    return { ok: true as const };
  }

  @Post('newsletter')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inscreve um e-mail na newsletter (com registro de consentimento)' })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async subscribe(@Body() body: NewsletterDto) {
    await this.contact.subscribeNewsletter(body);
    return { ok: true as const };
  }
}
