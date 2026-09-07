import type { AddressInput } from '@vellor/shared';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { products, productVariants } from './catalog';
import {
  couponTypeEnum,
  orderEventTypeEnum,
  orderStatusEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  shippingServiceEnum,
} from './enums';
import { users } from './users';

export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 1001, increment: 1 });

export const coupons = pgTable(
  'coupons',
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    description: text(),
    type: couponTypeEnum().notNull(),
    value: integer().notNull(),
    minSubtotalCents: integer().notNull().default(0),
    maxUses: integer(),
    maxUsesPerCustomer: integer(),
    usesCount: integer().notNull().default(0),
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('coupons_code_idx').on(t.code)],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    status: orderStatusEnum().notNull().default('pending_payment'),
    customerName: text().notNull(),
    customerEmail: text().notNull(),
    customerPhone: text().notNull(),
    customerCpfEncrypted: text().notNull(),
    customerCpfMasked: text().notNull(),
    shippingAddress: jsonb().$type<AddressInput>().notNull(),
    shippingService: shippingServiceEnum().notNull(),
    shippingDeadlineDays: integer().notNull().default(0),
    shippingCents: integer().notNull().default(0),
    insuranceCents: integer().notNull().default(0),
    subtotalCents: integer().notNull(),
    discountCents: integer().notNull().default(0),
    totalCents: integer().notNull(),
    couponId: uuid().references(() => coupons.id, { onDelete: 'set null' }),
    couponCode: text(),
    paymentMethod: paymentMethodEnum().notNull(),
    paymentStatus: paymentStatusEnum().notNull().default('pending'),
    installments: integer().notNull().default(1),
    installmentCents: integer().notNull(),
    providerName: text().notNull().default('asaas'),
    providerCustomerId: text(),
    providerPaymentId: text(),
    providerInvoiceUrl: text(),
    pixPayload: text(),
    pixQrCodeBase64: text(),
    pixExpiresAt: timestamp({ withTimezone: true }),
    boletoUrl: text(),
    boletoIdentificationField: text(),
    boletoDueDate: text(),
    paidAt: timestamp({ withTimezone: true }),
    shippedAt: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    trackingCode: text(),
    accessTokenHash: text().notNull(),
    notes: text(),
    internalNotes: text(),
    stockCommitted: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('orders_number_idx').on(t.number),
    index('orders_user_idx').on(t.userId),
    index('orders_status_idx').on(t.status),
    index('orders_created_idx').on(t.createdAt),
    index('orders_email_idx').on(t.customerEmail),
    index('orders_provider_payment_idx').on(t.providerPaymentId),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid().references(() => products.id, { onDelete: 'set null' }),
    variantId: uuid().references(() => productVariants.id, { onDelete: 'set null' }),
    productSlug: text(),
    name: text().notNull(),
    variantName: text().notNull(),
    sku: text().notNull(),
    imageUrl: text(),
    unitPriceCents: integer().notNull(),
    quantity: integer().notNull(),
    totalCents: integer().notNull(),
    weightGrams: integer().notNull().default(0),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    type: orderEventTypeEnum().notNull(),
    message: text().notNull(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    data: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('order_events_order_idx').on(t.orderId)],
);

export const paymentWebhookEvents = pgTable(
  'payment_webhook_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    provider: text().notNull(),
    eventId: text(),
    eventType: text().notNull(),
    providerPaymentId: text(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp({ withTimezone: true }),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('payment_webhook_events_event_idx').on(t.provider, t.eventId)],
);
