import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { SESSION_COOKIE } from '../../openapi';
import { SessionService } from './session.service';

/** Carrega a sessão a partir do cookie em toda requisição e expõe `req.auth` para guards e handlers. */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(
    private readonly sessions: SessionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SessionMiddleware.name);
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length >= 20 && token.length <= 128) {
      try {
        const auth = await this.sessions.resolve(token);
        if (auth) req.auth = auth;
        else this.sessions.clearCookie(res);
      } catch (error) {
        this.logger.warn({ err: error }, 'Falha ao resolver sessão');
      }
    }
    next();
  }
}
