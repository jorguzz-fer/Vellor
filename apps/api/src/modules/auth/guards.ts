import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ALLOW_MFA_PENDING } from '../../common/decorators';
import { ForbiddenError, UnauthorizedError } from '../../common/errors';
import type { AuthContext } from './auth.types';

function requireSession(context: ExecutionContext, reflector: Reflector): AuthContext {
  const req = context.switchToHttp().getRequest<Request>();
  if (!req.auth) throw new UnauthorizedError();
  const allowPending = reflector.getAllAndOverride<boolean>(ALLOW_MFA_PENDING, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (!allowPending && !req.auth.session.mfaVerified) {
    throw new UnauthorizedError(
      'Confirme o segundo fator de autenticação para continuar',
      req.auth.user.mfaEnabled ? 'mfa_required' : 'mfa_setup_required',
    );
  }
  return req.auth;
}

/** Exige sessão válida (cliente ou admin). */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    requireSession(context, this.reflector);
    return true;
  }
}

/** Exige sessão de administrador com MFA verificado. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const auth = requireSession(context, this.reflector);
    if (auth.user.role !== 'admin')
      throw new ForbiddenError('Área restrita a administradores', 'admin_only');
    return true;
  }
}
