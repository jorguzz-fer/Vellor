import 'reflect-metadata';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';
import { DatabaseService } from './database/database.module';
import { runMigrations } from './database/migrate';
import { MetricsService } from './health/metrics.service';
import { SessionMiddleware } from './modules/auth/session.middleware';
import { setupOpenApi } from './openapi';

export async function createApp(options: { logger?: false } = {}): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: options.logger !== false,
    logger: options.logger,
  });
  const config = app.get(AppConfig);

  if (options.logger !== false) {
    app.useLogger(app.get(Logger));
    app.flushLogs();
  }

  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.use(app.get(MetricsService).middleware());
  const sessionMiddleware = app.get(SessionMiddleware, { strict: false });
  app.use(
    (req: Request, res: Response, next: NextFunction) => void sessionMiddleware.use(req, res, next),
  );
  app.enableCors({
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'metrics'] });

  if (config.env.STORAGE_DRIVER === 'local') {
    app.useStaticAssets(path.resolve(config.env.STORAGE_LOCAL_DIR), {
      prefix: '/uploads/',
      maxAge: '7d',
      immutable: true,
      index: false,
    });
  }

  app.enableShutdownHooks();
  if (config.swaggerEnabled) setupOpenApi(app);
  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(AppConfig);
  const logger = app.get(Logger);

  if (config.env.SENTRY_DSN) {
    Sentry.init({
      dsn: config.env.SENTRY_DSN,
      environment: config.env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }

  if (config.env.RUN_MIGRATIONS) {
    logger.log('Aplicando migrations pendentes...');
    await runMigrations(app.get(DatabaseService).db);
  }

  await app.listen(config.env.PORT);
  logger.log(`API Vellor ouvindo na porta ${config.env.PORT} (${config.env.NODE_ENV})`);
  if (config.paymentsMock)
    logger.warn('Pagamentos em MODO SIMULADO: nenhuma cobrança real será criada.');
  if (!config.correiosEnabled)
    logger.warn('Correios sem credenciais: frete calculado pela tabela de contingência.');
  if (!config.mailEnabled)
    logger.warn('SMTP não configurado: e-mails serão apenas registrados no log.');
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
