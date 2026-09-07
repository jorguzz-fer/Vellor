import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { Request, Response } from 'express';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { PinoLogger } from 'nestjs-pino';
import { AppError } from '../errors';

const TITLES: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  403: 'Acesso negado',
  404: 'Não encontrado',
  405: 'Método não permitido',
  409: 'Conflito',
  413: 'Arquivo muito grande',
  415: 'Tipo de mídia não suportado',
  422: 'Não foi possível processar',
  429: 'Muitas requisições',
  500: 'Erro interno',
  502: 'Serviço externo indisponível',
  503: 'Serviço indisponível',
};

interface ZodIssueLike {
  path: PropertyKey[];
  message: string;
}

function flattenZodIssues(error: unknown): Record<string, string[]> {
  const issues = (error as { issues?: ZodIssueLike[] })?.issues ?? [];
  const out: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Converte qualquer exceção em application/problem+json (RFC 7807), sem vazar detalhes internos. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ProblemDetailsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let detail: string | undefined;
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST;
      code = 'validation_error';
      detail = 'Verifique os campos informados.';
      errors = flattenZodIssues(exception.getZodError());
    } else if (exception instanceof ZodSerializationException) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'serialization_error';
      this.logger.error(
        { err: exception, zod: exception.getZodError() },
        'Resposta fora do contrato',
      );
    } else if (exception instanceof AppError) {
      status = exception.getStatus();
      code = exception.code;
      detail = exception.message;
      errors = exception.errors;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        detail = body;
      } else if (body && typeof body === 'object') {
        const message = (body as { message?: string | string[] }).message;
        detail = Array.isArray(message) ? message.join('; ') : message;
      }
      code = status === 429 ? 'too_many_requests' : `http_${status}`;
    }

    if (status >= 500) {
      this.logger.error(
        { err: exception, reqId: req.id, url: req.originalUrl },
        'Erro não tratado',
      );
      if (process.env.SENTRY_DSN) Sentry.captureException(exception);
      detail = 'Ocorreu um erro inesperado. Tente novamente em instantes.';
    }

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `urn:vellor:error:${code}`,
        title: TITLES[status] ?? 'Erro',
        status,
        detail,
        instance: req.originalUrl,
        code,
        errors,
        requestId: req.id,
      });
  }
}
