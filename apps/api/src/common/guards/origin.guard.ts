import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config';
import { SKIP_ORIGIN_CHECK } from '../decorators';
import { ForbiddenError } from '../errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteção anti-CSRF em profundidade: além do cookie SameSite=Lax, toda requisição
 * mutável vinda de navegador precisa ter Origin em uma lista permitida.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    private readonly config: AppConfig,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ORIGIN_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const origin = req.headers.origin;
    if (origin) {
      if (!this.config.allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        throw new ForbiddenError('Origem da requisição não permitida', 'origin_not_allowed');
      }
      return true;
    }

    const fetchSite = req.headers['sec-fetch-site'];
    if (fetchSite === 'cross-site') {
      throw new ForbiddenError('Origem da requisição não permitida', 'origin_not_allowed');
    }
    return true;
  }
}
