import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TeamInviteInputSchema, TeamInviteResultSchema, TeamMemberSchema } from '@vellor/shared';
import { ZodSerializerDto, createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ClientIp, CurrentAuth } from '../../common/decorators';
import type { AuthContext } from '../auth/auth.types';
import { OkDto } from '../auth/dto';
import { AdminGuard } from '../auth/guards';
import { TeamService } from './team.service';

class TeamListDto extends createZodDto(z.array(TeamMemberSchema)) {}
class TeamInviteDto extends createZodDto(TeamInviteInputSchema) {}
class TeamInviteResultDto extends createZodDto(TeamInviteResultSchema) {}

@ApiTags('admin')
@ApiCookieAuth()
@UseGuards(AdminGuard)
@Controller('admin/team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os administradores do painel' })
  @ApiOkResponse({ type: TeamListDto })
  @ZodSerializerDto(TeamListDto)
  list() {
    return this.team.list();
  }

  @Post('invites')
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Convida um administrador (cria a conta ou promove um cliente) e devolve o link para definir a senha',
  })
  @ApiCreatedResponse({ type: TeamInviteResultDto })
  @ZodSerializerDto(TeamInviteResultDto)
  invite(@Body() body: TeamInviteDto, @CurrentAuth() auth: AuthContext, @ClientIp() ip: string) {
    return this.team.invite(body, auth.user, ip);
  }

  @Post(':id/reset-mfa')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remove o segundo fator do administrador, que o configura de novo no próximo acesso',
  })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async resetMfa(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @ClientIp() ip: string,
  ) {
    await this.team.resetMfa(id, auth.user, ip);
    return { ok: true as const };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove o acesso administrativo (a conta volta a ser de cliente)' })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async revoke(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @ClientIp() ip: string) {
    await this.team.revoke(id, auth.user, ip);
    return { ok: true as const };
  }
}
