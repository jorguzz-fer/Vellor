import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export const SESSION_COOKIE = 'vellor_sid';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Vellor API')
    .setDescription(
      'API da loja Vellor (relógios de luxo e perfumes de nicho). Autenticação por cookie de sessão httpOnly; erros no formato RFC 7807 (application/problem+json).',
    )
    .setVersion('1.0.0')
    .addCookieAuth(SESSION_COOKIE, { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE })
    .addTag('auth', 'Cadastro, login, sessão e MFA')
    .addTag('catalog', 'Catálogo público')
    .addTag('checkout', 'Cotação, frete e criação de pedidos')
    .addTag('orders', 'Consulta de pedidos')
    .addTag('account', 'Conta do cliente')
    .addTag('contact', 'Atendimento e newsletter')
    .addTag('settings', 'Configurações públicas da loja')
    .addTag('webhooks', 'Webhooks de provedores externos')
    .addTag('admin', 'Painel administrativo (exige admin + MFA)')
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_c, method) => method,
  });
  return cleanupOpenApiDoc(document);
}

export function setupOpenApi(app: INestApplication): void {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs/openapi.json',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    customSiteTitle: 'Vellor API',
  });
}
