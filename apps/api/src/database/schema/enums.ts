import {
  CATEGORY_KINDS,
  CONTACT_STATUSES,
  COUPON_TYPES,
  ORDER_EVENT_TYPES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PRODUCT_STATUSES,
  SHIPPING_SERVICES,
  USER_ROLES,
} from '@vellor/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const categoryKindEnum = pgEnum('category_kind', CATEGORY_KINDS);
export const productStatusEnum = pgEnum('product_status', PRODUCT_STATUSES);
export const couponTypeEnum = pgEnum('coupon_type', COUPON_TYPES);
export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES);
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);
export const shippingServiceEnum = pgEnum('shipping_service', SHIPPING_SERVICES);
export const orderEventTypeEnum = pgEnum('order_event_type', ORDER_EVENT_TYPES);
export const contactStatusEnum = pgEnum('contact_status', CONTACT_STATUSES);
export const outboxStatusEnum = pgEnum('outbox_status', [
  'pending',
  'processing',
  'done',
  'failed',
  'dead',
]);
