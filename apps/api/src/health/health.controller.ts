import { Controller, Get, Headers, Header, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppConfig } from '../config/app-config';
import { DatabaseService } from '../database/database.module';
import { ForbiddenError } from '../common/errors';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly metrics: MetricsService,
    private readonly config: AppConfig,
  ) {}

  /** Liveness: o processo responde. */
  @Get('health')
  health() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  /** Readiness: dependências essenciais (banco) respondem. */
  @Get('ready')
  async ready() {
    try {
      await this.database.ping();
      return { status: 'ready', database: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'error' });
    }
  }

  /** Métricas Prometheus. Exposto só na rede interna; opcionalmente protegido por token. */
  @Get('metrics')
  @Header('Cache-Control', 'no-store')
  async metricsEndpoint(@Headers('authorization') authorization?: string) {
    const token = this.config.env.METRICS_TOKEN;
    if (token && authorization !== `Bearer ${token}`) {
      throw new ForbiddenError('Token de métricas inválido', 'metrics_forbidden');
    }
    return this.metrics.render();
  }
}
