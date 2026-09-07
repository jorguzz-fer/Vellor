import { Global, Injectable, Module } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/** Métricas de processo e de requisições HTTP no formato Prometheus. */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly httpDuration: Histogram<string>;
  private readonly httpTotal: Counter<string>;
  readonly ordersCreated: Counter<string>;
  readonly paymentsConfirmed: Counter<string>;
  readonly outboxFailures: Counter<string>;

  constructor() {
    this.registry.setDefaultLabels({ app: 'vellor-api' });
    collectDefaultMetrics({ register: this.registry });
    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duração das requisições HTTP',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
    this.httpTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total de requisições HTTP',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    this.ordersCreated = new Counter({
      name: 'vellor_orders_created_total',
      help: 'Pedidos criados',
      labelNames: ['payment_method'],
      registers: [this.registry],
    });
    this.paymentsConfirmed = new Counter({
      name: 'vellor_payments_confirmed_total',
      help: 'Pagamentos confirmados',
      labelNames: ['payment_method'],
      registers: [this.registry],
    });
    this.outboxFailures = new Counter({
      name: 'vellor_outbox_failures_total',
      help: 'Falhas no processamento do outbox',
      labelNames: ['type'],
      registers: [this.registry],
    });
  }

  /** Middleware Express que observa duração e contagem por rota. */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const route = (req.route?.path as string | undefined)
          ? `${req.baseUrl ?? ''}${req.route.path}`
          : req.originalUrl.startsWith('/uploads')
            ? '/uploads/*'
            : 'unmatched';
        const labels = { method: req.method, route, status: String(res.statusCode) };
        const seconds = Number(process.hrtime.bigint() - start) / 1e9;
        this.httpDuration.observe(labels, seconds);
        this.httpTotal.inc(labels);
      });
      next();
    };
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}

@Global()
@Module({ providers: [MetricsService], exports: [MetricsService] })
export class MetricsModule {}
