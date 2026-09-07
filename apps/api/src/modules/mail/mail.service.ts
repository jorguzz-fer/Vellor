import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config';
import { SettingsService } from '../settings/settings.service';
import type { TemplateContext } from './templates';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Envio de e-mails transacionais via SMTP. Sem SMTP configurado, apenas registra no log. */
@Injectable()
export class MailService {
  private readonly transporter: Transporter | null;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
    private readonly settings: SettingsService,
  ) {
    this.logger.setContext(MailService.name);
    const env = config.env;
    this.transporter = env.SMTP_HOST
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        })
      : null;
  }

  /** Dados da loja usados pelos templates (nome, canais de atendimento, URL). */
  async context(): Promise<TemplateContext> {
    const store = (await this.settings.get()).store;
    return {
      storeName: store.name,
      appUrl: this.config.env.APP_URL,
      supportEmail: store.email,
      whatsapp: store.whatsapp,
    };
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.info(
        { to: message.to, subject: message.subject },
        'E-mail simulado (SMTP não configurado)',
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.config.env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    this.logger.info({ to: message.to, subject: message.subject }, 'E-mail enviado');
  }
}
