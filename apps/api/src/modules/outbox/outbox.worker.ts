import {
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../../config/app-config';
import { OutboxService } from './outbox.service';

/** Loop de processamento do outbox dentro do próprio processo da API (sem Redis na v1). */
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly outbox: OutboxService,
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OutboxWorker.name);
  }

  onApplicationBootstrap(): void {
    if (this.config.isTest) return;
    this.timer = setInterval(() => void this.tick(), this.config.env.OUTBOX_POLL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let processed = 0;
      do {
        processed = await this.outbox.processBatch();
      } while (processed > 0);
    } catch (error) {
      this.logger.error({ err: error }, 'Erro no loop do outbox');
    } finally {
      this.running = false;
    }
  }
}
