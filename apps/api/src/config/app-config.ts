import { Global, Injectable, Module } from '@nestjs/common';
import { type Env, loadEnv } from './env';

@Injectable()
export class AppConfig {
  readonly env: Env;

  constructor(env?: Env) {
    this.env = env ?? loadEnv();
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  /** Origens autorizadas a fazer requisições mutáveis com cookie de sessão. */
  get allowedOrigins(): string[] {
    const origins = new Set<string>([this.env.APP_URL]);
    if (this.env.API_PUBLIC_URL) origins.add(this.env.API_PUBLIC_URL);
    for (const o of (this.env.ALLOWED_ORIGINS ?? '').split(',')) {
      const trimmed = o.trim();
      if (trimmed) origins.add(trimmed);
    }
    if (!this.isProduction) {
      origins.add('http://localhost:3000');
      origins.add('http://127.0.0.1:3000');
      origins.add(`http://localhost:${this.env.PORT}`);
      origins.add(`http://127.0.0.1:${this.env.PORT}`);
    }
    return [...origins].map((o) => o.replace(/\/$/, ''));
  }

  get cookieSecure(): boolean {
    return this.env.COOKIE_SECURE ?? this.isProduction;
  }

  get trustProxy(): boolean {
    return this.env.TRUST_PROXY ?? this.isProduction;
  }

  /** Pagamentos simulados quando não há chave do Asaas (nunca silenciosamente em produção). */
  get paymentsMock(): boolean {
    return this.env.PAYMENTS_MOCK || !this.env.ASAAS_API_KEY;
  }

  get correiosEnabled(): boolean {
    return Boolean(
      this.env.CORREIOS_USER && this.env.CORREIOS_ACCESS_CODE && this.env.CORREIOS_POSTAGE_CARD,
    );
  }

  get mailEnabled(): boolean {
    return Boolean(this.env.SMTP_HOST);
  }

  get apiPublicUrl(): string {
    return (this.env.API_PUBLIC_URL ?? this.env.APP_URL).replace(/\/$/, '');
  }

  get swaggerEnabled(): boolean {
    return this.env.SWAGGER_ENABLED ?? !this.isProduction;
  }
}

@Global()
@Module({
  providers: [{ provide: AppConfig, useFactory: () => new AppConfig() }],
  exports: [AppConfig],
})
export class AppConfigModule {}
