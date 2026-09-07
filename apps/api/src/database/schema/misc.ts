import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { products } from './catalog';
import { contactStatusEnum, outboxStatusEnum } from './enums';
import { users } from './users';

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    type: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    status: outboxStatusEnum().notNull().default('pending'),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastError: text(),
    processedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('outbox_events_status_next_idx').on(t.status, t.nextAttemptAt)],
);

export const contactRequests = pgTable(
  'contact_requests',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    email: text().notNull(),
    phone: text(),
    subject: text().notNull(),
    message: text().notNull(),
    productId: uuid().references(() => products.id, { onDelete: 'set null' }),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    status: contactStatusEnum().notNull().default('new'),
    internalNotes: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contact_requests_status_idx').on(t.status)],
);

export const newsletterSubscribers = pgTable(
  'newsletter_subscribers',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    name: text(),
    source: text().notNull().default('site'),
    consentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp({ withTimezone: true }),
    unsubscribeTokenHash: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('newsletter_subscribers_email_idx').on(t.email)],
);

export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  updatedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    summary: text(),
    data: jsonb().$type<Record<string, unknown>>(),
    ip: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entity, t.entityId),
    index('audit_logs_created_idx').on(t.createdAt),
  ],
);
