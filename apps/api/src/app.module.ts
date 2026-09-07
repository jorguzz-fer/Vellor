import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request } from 'express';
import { LoggerModule } from 'nestjs-pino';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { CryptoModule } from './common/crypto/crypto.service';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { OriginGuard } from './common/guards/origin.guard';
import { AppConfig, AppConfigModule } from './config/app-config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { MetricsModule } from './health/metrics.service';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StorageModule } from './modules/storage/storage.module';
import { MailModule } from './modules/mail/mail.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { AuditModule } from './modules/audit/audit.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AccountModule } from './modules/account/account.module';
import { ContactModule } from './modules/contact/contact.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.env.LOG_LEVEL,
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const incoming = req.headers['x-request-id'];
            const id =
              typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: {
            paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
            censor: '[redigido]',
          },
          customProps: (req: IncomingMessage) => ({ userId: (req as Request).auth?.user.id }),
          autoLogging: {
            ignore: (req: IncomingMessage) => {
              const url = req.url ?? '';
              return /^\/(health|ready|metrics)/.test(url) || url.startsWith('/uploads');
            },
          },
          serializers: {
            req: (req: { id: string; method: string; url: string; remoteAddress?: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
              ip: req.remoteAddress,
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          transport:
            config.env.NODE_ENV === 'development'
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
                }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }] }),
    ScheduleModule.forRoot(),
    CryptoModule,
    DatabaseModule,
    MetricsModule,
    AuditModule,
    SettingsModule,
    StorageModule,
    MailModule,
    OutboxModule,
    AuthModule,
    CatalogModule,
    ShippingModule,
    PaymentsModule,
    CheckoutModule,
    OrdersModule,
    AccountModule,
    ContactModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class AppModule {}
