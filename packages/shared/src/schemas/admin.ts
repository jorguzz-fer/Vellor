import { z } from 'zod';
import {
  CONTACT_STATUSES,
  COUPON_TYPES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from '../enums.js';
import { AddressInputSchema, OrderSchema, OrderSummarySchema } from './checkout.js';
import { PaginationQuerySchema } from './common.js';

export const CouponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'Mínimo de 3 caracteres')
      .max(32)
      .regex(/^[A-Z0-9_-]+$/, 'Use apenas letras, números, hífen e sublinhado'),
    description: z.string().trim().max(160).nullable().optional(),
    type: z.enum(COUPON_TYPES),
    /** Percentual (1-100) quando type = percent; centavos quando type = fixed. */
    value: z.number().int().min(1),
    minSubtotalCents: z.number().int().min(0).default(0),
    maxUses: z.number().int().min(1).nullable().optional(),
    maxUsesPerCustomer: z.number().int().min(1).nullable().optional(),
    startsAt: z.iso.datetime().nullable().optional(),
    endsAt: z.iso.datetime().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((c) => c.type !== 'percent' || c.value <= 100, {
    message: 'Percentual máximo é 100',
    path: ['value'],
  });
export type CouponInput = z.infer<typeof CouponInputSchema>;

export const CouponSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  description: z.string().nullable(),
  type: z.enum(COUPON_TYPES),
  value: z.number().int(),
  minSubtotalCents: z.number().int(),
  maxUses: z.number().int().nullable(),
  maxUsesPerCustomer: z.number().int().nullable(),
  usesCount: z.number().int(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type Coupon = z.infer<typeof CouponSchema>;

export const ORDER_ACTIONS = [
  'mark_paid',
  'mark_processing',
  'mark_shipped',
  'mark_delivered',
  'cancel',
  'add_note',
  'mark_refunded',
] as const;

export const ORDER_ACTION_LABELS: Record<(typeof ORDER_ACTIONS)[number], string> = {
  mark_paid: 'Confirmar pagamento manualmente',
  mark_processing: 'Iniciar separação',
  mark_shipped: 'Marcar como enviado',
  mark_delivered: 'Marcar como entregue',
  cancel: 'Cancelar pedido',
  add_note: 'Adicionar observação interna',
  mark_refunded: 'Registrar reembolso',
};
export type OrderAction = (typeof ORDER_ACTIONS)[number];

export const OrderActionInputSchema = z.object({
  action: z.enum(ORDER_ACTIONS),
  trackingCode: z.string().trim().max(40).optional(),
  note: z.string().trim().max(500).optional(),
});
export type OrderActionInput = z.infer<typeof OrderActionInputSchema>;

export const AdminOrderQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AdminOrderQuery = z.infer<typeof AdminOrderQuerySchema>;

export const AdminOrderSchema = OrderSchema.extend({
  userId: z.uuid().nullable(),
  customer: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    cpf: z.string(),
  }),
  providerPaymentId: z.string().nullable(),
  providerCustomerId: z.string().nullable(),
  internalNotes: z.string().nullable(),
});
export type AdminOrder = z.infer<typeof AdminOrderSchema>;

export const DashboardStatsSchema = z.object({
  revenueTodayCents: z.number().int(),
  revenue7dCents: z.number().int(),
  revenue30dCents: z.number().int(),
  ordersToday: z.number().int(),
  orders30d: z.number().int(),
  averageTicket30dCents: z.number().int(),
  ordersByStatus: z.record(z.enum(ORDER_STATUSES), z.number().int()),
  lowStock: z.array(
    z.object({
      productId: z.uuid(),
      productName: z.string(),
      variantName: z.string(),
      sku: z.string(),
      stockQuantity: z.number().int(),
    }),
  ),
  recentOrders: z.array(OrderSummarySchema),
  pendingContacts: z.number().int(),
  newsletterSubscribers: z.number().int(),
  salesByDay: z.array(
    z.object({ date: z.string(), revenueCents: z.number().int(), orders: z.number().int() }),
  ),
});
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

export const CustomerSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  cpfMasked: z.string().nullable(),
  ordersCount: z.number().int(),
  totalSpentCents: z.number().int(),
  newsletterOptIn: z.boolean(),
  createdAt: z.string(),
  lastOrderAt: z.string().nullable(),
});
export type CustomerSummary = z.infer<typeof CustomerSummarySchema>;

export const CustomerDetailSchema = CustomerSummarySchema.extend({
  addresses: z.array(
    AddressInputSchema.extend({
      id: z.uuid(),
      label: z.string().nullable(),
      isDefault: z.boolean(),
    }),
  ),
  orders: z.array(OrderSummarySchema),
});
export type CustomerDetail = z.infer<typeof CustomerDetailSchema>;

export const AdminCustomerQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
});

export const ContactRequestSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  subject: z.string(),
  message: z.string(),
  productId: z.uuid().nullable(),
  productName: z.string().nullable(),
  status: z.enum(CONTACT_STATUSES),
  internalNotes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ContactRequest = z.infer<typeof ContactRequestSchema>;

export const ContactRequestUpdateSchema = z.object({
  status: z.enum(CONTACT_STATUSES).optional(),
  internalNotes: z.string().trim().max(2000).nullable().optional(),
});
export type ContactRequestUpdate = z.infer<typeof ContactRequestUpdateSchema>;

export const AdminContactQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(CONTACT_STATUSES).optional(),
});

export const NewsletterSubscriberSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string().nullable(),
  source: z.string(),
  consentAt: z.string(),
  unsubscribedAt: z.string().nullable(),
});
export type NewsletterSubscriber = z.infer<typeof NewsletterSubscriberSchema>;

export const AuditLogSchema = z.object({
  id: z.uuid(),
  actorId: z.uuid().nullable(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  summary: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.string(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

export const AdminAuditQuerySchema = PaginationQuerySchema.extend({
  entity: z.string().max(40).optional(),
  actorId: z.uuid().optional(),
});

// ---------- Equipe (administradores do painel) ----------

export const TeamMemberSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  mfaEnabled: z.boolean(),
  /** Nunca entrou no painel: o convite ainda não foi concluído. */
  invitePending: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamInviteInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(120, 'Máximo de 120 caracteres'),
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail inválido')),
});
export type TeamInviteInput = z.infer<typeof TeamInviteInputSchema>;

export const TeamInviteResultSchema = z.object({
  member: TeamMemberSchema,
  /** Link para a pessoa definir a própria senha; vale por 7 dias. */
  setupUrl: z.string(),
  expiresAt: z.string(),
  /** true quando há SMTP configurado e o link também foi enviado por e-mail. */
  emailQueued: z.boolean(),
  /** true quando o e-mail já era de um cliente, que foi promovido a administrador. */
  promoted: z.boolean(),
});
export type TeamInviteResult = z.infer<typeof TeamInviteResultSchema>;
