import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from '../modules/auth/auth.types';

export const SKIP_ORIGIN_CHECK = 'skipOriginCheck';
/** Desliga a verificação de Origin (apenas para webhooks servidor-a-servidor). */
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK, true);

export const ALLOW_MFA_PENDING = 'allowMfaPending';
/** Permite acesso com sessão cujo segundo fator ainda não foi verificado (fluxo de MFA). */
export const AllowMfaPending = () => SetMetadata(ALLOW_MFA_PENDING, true);

/** Injeta o contexto de autenticação (usuário + sessão) carregado pelo middleware de sessão. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.auth;
  },
);

export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.ip ?? '';
});
