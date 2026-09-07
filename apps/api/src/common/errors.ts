import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Erro de domínio com código estável para o cliente e mensagem em pt-BR.
 * O filtro global converte em application/problem+json (RFC 7807).
 */
export class AppError extends HttpException {
  constructor(
    statusCode: number,
    readonly code: string,
    message: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super({ code, message, errors }, statusCode);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado', code = 'not_found') {
    super(HttpStatus.NOT_FOUND, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'conflict') {
    super(HttpStatus.CONFLICT, code, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Faça login para continuar', code = 'unauthorized') {
    super(HttpStatus.UNAUTHORIZED, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem permissão para esta ação', code = 'forbidden') {
    super(HttpStatus.FORBIDDEN, code, message);
  }
}

export class UnprocessableError extends AppError {
  constructor(message: string, code = 'unprocessable', errors?: Record<string, string[]>) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, code, message, errors);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = 'bad_request', errors?: Record<string, string[]>) {
    super(HttpStatus.BAD_REQUEST, code, message, errors);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, code = 'external_service_error') {
    super(HttpStatus.BAD_GATEWAY, code, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Muitas tentativas. Aguarde alguns minutos.', code = 'too_many_requests') {
    super(HttpStatus.TOO_MANY_REQUESTS, code, message);
  }
}
