import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';
import { AllowMfaPending, ClientIp, CurrentAuth } from '../../common/decorators';
import { AuthService, type LoginResult } from './auth.service';
import type { AuthContext } from './auth.types';
import {
  AuthStatusDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  MeDto,
  MfaCodeDto,
  MfaSetupResponseDto,
  OkDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto';
import { AuthenticatedGuard } from './guards';
import { SessionService } from './session.service';

const STRICT = { default: { limit: 10, ttl: 60_000 } };
const VERY_STRICT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  private applyLogin(res: Response, result: LoginResult): AuthStatusDto {
    this.sessions.setCookie(res, result.token, result.role);
    return result.status;
  }

  @Post('register')
  @Throttle(VERY_STRICT)
  @ApiOperation({ summary: 'Cria uma conta de cliente e inicia a sessão' })
  @ApiOkResponse({ type: AuthStatusDto })
  @ZodSerializerDto(AuthStatusDto)
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @ClientIp() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.applyLogin(res, await this.auth.register(body, { ip, userAgent }));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(STRICT)
  @ApiOperation({ summary: 'Login com e-mail e senha (cookie de sessão httpOnly)' })
  @ApiOkResponse({ type: AuthStatusDto })
  @ZodSerializerDto(AuthStatusDto)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @ClientIp() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.applyLogin(res, await this.auth.login(body, { ip, userAgent }));
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Encerra a sessão atual' })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async logout(
    @CurrentAuth() auth: AuthContext | undefined,
    @Res({ passthrough: true }) res: Response,
    @ClientIp() ip: string,
  ) {
    await this.auth.logout(auth, { ip });
    this.sessions.clearCookie(res);
    return { ok: true as const };
  }

  @Get('me')
  @ApiOperation({ summary: 'Estado da sessão atual (também para visitantes)' })
  @ApiOkResponse({ type: AuthStatusDto })
  @ZodSerializerDto(AuthStatusDto)
  me(@CurrentAuth() auth?: AuthContext) {
    return this.auth.status(auth);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle(VERY_STRICT)
  @ApiOperation({
    summary: 'Envia link de redefinição de senha (resposta idêntica mesmo se o e-mail não existir)',
  })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async forgotPassword(@Body() body: ForgotPasswordDto, @ClientIp() ip: string) {
    await this.auth.forgotPassword(body, { ip });
    return { ok: true as const };
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle(VERY_STRICT)
  @ApiOperation({ summary: 'Define nova senha a partir do token recebido por e-mail' })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async resetPassword(@Body() body: ResetPasswordDto, @ClientIp() ip: string) {
    await this.auth.resetPassword(body, { ip });
    return { ok: true as const };
  }

  @Post('change-password')
  @HttpCode(200)
  @Throttle(STRICT)
  @UseGuards(AuthenticatedGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Troca a senha do usuário logado (encerra as outras sessões)' })
  @ApiOkResponse({ type: OkDto })
  @ZodSerializerDto(OkDto)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ChangePasswordDto,
    @ClientIp() ip: string,
  ) {
    await this.auth.changePassword(auth, body, { ip });
    return { ok: true as const };
  }

  @Post('mfa/setup')
  @HttpCode(200)
  @UseGuards(AuthenticatedGuard)
  @AllowMfaPending()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Gera segredo TOTP e QR code para ativar o segundo fator' })
  @ApiOkResponse({ type: MfaSetupResponseDto })
  @ZodSerializerDto(MfaSetupResponseDto)
  mfaSetup(@CurrentAuth() auth: AuthContext) {
    return this.auth.mfaSetup(auth);
  }

  @Post('mfa/enable')
  @HttpCode(200)
  @Throttle(STRICT)
  @UseGuards(AuthenticatedGuard)
  @AllowMfaPending()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Confirma o código do app autenticador e ativa o MFA' })
  @ApiOkResponse({ type: AuthStatusDto })
  @ZodSerializerDto(AuthStatusDto)
  mfaEnable(@CurrentAuth() auth: AuthContext, @Body() body: MfaCodeDto, @ClientIp() ip: string) {
    return this.auth.mfaEnable(auth, body.code, { ip });
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @Throttle(STRICT)
  @UseGuards(AuthenticatedGuard)
  @AllowMfaPending()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Verifica o código TOTP da sessão atual' })
  @ApiOkResponse({ type: AuthStatusDto })
  @ZodSerializerDto(AuthStatusDto)
  mfaVerify(@CurrentAuth() auth: AuthContext, @Body() body: MfaCodeDto, @ClientIp() ip: string) {
    return this.auth.mfaVerify(auth, body.code, { ip });
  }

  @Patch('profile')
  @UseGuards(AuthenticatedGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Atualiza nome, telefone, CPF e preferência de newsletter' })
  @ApiOkResponse({ type: MeDto })
  @ZodSerializerDto(MeDto)
  updateProfile(@CurrentAuth() auth: AuthContext, @Body() body: UpdateProfileDto) {
    return this.auth.updateProfile(auth, body);
  }
}
