import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  CONTACT_SUBJECT_LABELS,
  type ContactInput,
  type ContactRequest,
  type ContactRequestUpdate,
  type ContactStatus,
  type ContactSubject,
  type NewsletterInput,
  type NewsletterSubscriber,
  type Paginated,
} from '@vellor/shared';
import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { NotFoundError } from '../../common/errors';
import { AppConfig } from '../../config/app-config';
import { type Database, InjectDb } from '../../database/database.module';
import { contactRequests, newsletterSubscribers, products } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import type { AuthContext, AuthUser } from '../auth/auth.types';
import { MailService } from '../mail/mail.service';
import { adminNotificationTemplate, contactReceivedTemplate } from '../mail/templates';
import { OutboxService } from '../outbox/outbox.service';

@Injectable()
export class ContactService implements OnModuleInit {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly outbox: OutboxService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.outbox.register('email.contact_received', async (payload) => {
      const ctx = await this.mail.context();
      await this.mail.send({
        to: String(payload.to),
        ...contactReceivedTemplate(ctx, String(payload.name)),
      });
    });
    this.outbox.register('email.admin_notification', async (payload) => {
      const ctx = await this.mail.context();
      const lines = Array.isArray(payload.lines) ? payload.lines.map(String) : [];
      await this.mail.send({
        to: ctx.supportEmail,
        ...adminNotificationTemplate(
          ctx,
          String(payload.title),
          lines,
          payload.link ? String(payload.link) : undefined,
        ),
      });
    });
  }

  async createContact(input: ContactInput, auth?: AuthContext): Promise<void> {
    if (input.website) return; // honeypot preenchido: bot
    let productName: string | null = null;
    if (input.productId) {
      const product = await this.db.query.products.findFirst({
        where: eq(products.id, input.productId),
        columns: { name: true },
      });
      productName = product?.name ?? null;
    }
    const [row] = await this.db
      .insert(contactRequests)
      .values({
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        subject: input.subject,
        message: input.message,
        productId: productName ? input.productId! : null,
        userId: auth?.user.id ?? null,
      })
      .returning({ id: contactRequests.id });
    await this.outbox.enqueue('email.contact_received', { to: input.email, name: input.name });
    await this.outbox.enqueue('email.admin_notification', {
      title: 'Nova mensagem no atendimento',
      lines: [
        `De: ${input.name} <${input.email}>${input.phone ? ` · ${input.phone}` : ''}`,
        `Assunto: ${CONTACT_SUBJECT_LABELS[input.subject as ContactSubject] ?? input.subject}`,
        productName ? `Produto: ${productName}` : '',
        input.message,
      ].filter(Boolean),
      link: `${this.config.env.APP_URL}/admin/atendimento/${row!.id}`,
    });
  }

  async subscribeNewsletter(input: NewsletterInput): Promise<void> {
    if (input.website) return;
    await this.db
      .insert(newsletterSubscribers)
      .values({
        email: input.email,
        name: input.name ?? null,
        source: input.source ?? 'site',
        consentAt: new Date(),
      })
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        set: { unsubscribedAt: null, consentAt: new Date(), name: input.name ?? null },
      });
  }

  // ---------- Admin ----------

  private toContact(
    row: typeof contactRequests.$inferSelect & { product?: { name: string } | null },
  ): ContactRequest {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      subject: row.subject,
      message: row.message,
      productId: row.productId,
      productName: row.product?.name ?? null,
      status: row.status,
      internalNotes: row.internalNotes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listContacts(query: {
    page: number;
    pageSize: number;
    status?: ContactStatus;
  }): Promise<Paginated<ContactRequest>> {
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(contactRequests.status, query.status));
    const where = conditions.length ? and(...conditions) : undefined;
    const [{ total }] = await this.db.select({ total: count() }).from(contactRequests).where(where);
    const rows = await this.db.query.contactRequests.findMany({
      where,
      with: { product: { columns: { name: true } } },
      orderBy: [desc(contactRequests.createdAt)],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
    return {
      items: rows.map((r) => this.toContact(r)),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / query.pageSize)),
    };
  }

  async getContact(id: string): Promise<ContactRequest> {
    const row = await this.db.query.contactRequests.findFirst({
      where: eq(contactRequests.id, id),
      with: { product: { columns: { name: true } } },
    });
    if (!row) throw new NotFoundError('Mensagem não encontrada', 'contact_not_found');
    return this.toContact(row);
  }

  async updateContact(
    id: string,
    input: ContactRequestUpdate,
    actor: AuthUser,
    ip?: string,
  ): Promise<ContactRequest> {
    const [row] = await this.db
      .update(contactRequests)
      .set({
        ...(input.status ? { status: input.status } : {}),
        ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(contactRequests.id, id))
      .returning();
    if (!row) throw new NotFoundError('Mensagem não encontrada', 'contact_not_found');
    await this.audit.record({
      actor,
      action: 'contact.update',
      entity: 'contact_request',
      entityId: id,
      summary: input.status ?? 'Notas atualizadas',
      ip,
    });
    return this.getContact(id);
  }

  async listSubscribers(query: {
    page: number;
    pageSize: number;
  }): Promise<Paginated<NewsletterSubscriber>> {
    const where = isNull(newsletterSubscribers.unsubscribedAt);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(newsletterSubscribers)
      .where(where);
    const rows = await this.db.query.newsletterSubscribers.findMany({
      where,
      orderBy: [desc(newsletterSubscribers.consentAt)],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        source: r.source,
        consentAt: r.consentAt.toISOString(),
        unsubscribedAt: r.unsubscribedAt?.toISOString() ?? null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(total),
      totalPages: Math.max(1, Math.ceil(Number(total) / query.pageSize)),
    };
  }

  async exportSubscribersCsv(actor: AuthUser, ip?: string): Promise<string> {
    const rows = await this.db.query.newsletterSubscribers.findMany({
      where: isNull(newsletterSubscribers.unsubscribedAt),
      orderBy: [desc(newsletterSubscribers.consentAt)],
    });
    await this.audit.record({
      actor,
      action: 'newsletter.export',
      entity: 'newsletter',
      summary: `${rows.length} contatos exportados`,
      ip,
    });
    const escape = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
    return [
      'email,nome,origem,consentimento_em',
      ...rows.map((r) =>
        [escape(r.email), escape(r.name), escape(r.source), escape(r.consentAt.toISOString())].join(
          ',',
        ),
      ),
    ].join('\n');
  }
}
