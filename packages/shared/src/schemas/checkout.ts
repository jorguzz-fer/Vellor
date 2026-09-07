import { z } from 'zod';
import {
  BRAZIL_STATES,
  ORDER_EVENT_TYPES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  SHIPPING_SERVICES,
} from '../enums.js';
import { isValidCEP, normalizeCEP } from '../validators.js';
import { CpfSchema, EmailSchema, PhoneSchema } from './auth.js';

export const CepSchema = z.string().transform(normalizeCEP).refine(isValidCEP, 'CEP inválido');

export const CheckoutItemSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(10),
});
export type CheckoutItem = z.infer<typeof CheckoutItemSchema>;

export const AddressInputSchema = z.object({
  recipientName: z.string().trim().min(3).max(120).optional(),
  cep: CepSchema,
  street: z.string().trim().min(2, 'Informe a rua').max(160),
  number: z.string().trim().min(1, 'Informe o número').max(20),
  complement: z.string().trim().max(80).nullable().optional(),
  district: z.string().trim().min(2, 'Informe o bairro').max(80),
  city: z.string().trim().min(2, 'Informe a cidade').max(80),
  state: z.enum(BRAZIL_STATES, { error: 'Selecione o estado' }),
  reference: z.string().trim().max(160).nullable().optional(),
});
export type AddressInput = z.infer<typeof AddressInputSchema>;

export const AddressSchema = AddressInputSchema.extend({
  id: z.uuid(),
  label: z.string().nullable(),
  isDefault: z.boolean(),
});
export type Address = z.infer<typeof AddressSchema>;

export const SaveAddressInputSchema = AddressInputSchema.extend({
  label: z.string().trim().max(40).nullable().optional(),
  isDefault: z.boolean().optional(),
});
export type SaveAddressInput = z.infer<typeof SaveAddressInputSchema>;

export const CheckoutCustomerSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome completo').max(120),
  email: EmailSchema,
  phone: PhoneSchema,
  cpf: CpfSchema,
});
export type CheckoutCustomer = z.infer<typeof CheckoutCustomerSchema>;

export const ShippingQuoteInputSchema = z.object({
  cep: CepSchema,
  items: z.array(CheckoutItemSchema).min(1).max(20),
});
export type ShippingQuoteInput = z.infer<typeof ShippingQuoteInputSchema>;

export const ShippingOptionSchema = z.object({
  service: z.enum(SHIPPING_SERVICES),
  name: z.string(),
  /** Frete sem o seguro. */
  freightCents: z.number().int(),
  /** Seguro (valor declarado). */
  insuranceCents: z.number().int(),
  /** Frete + seguro: valor cobrado do cliente. */
  totalCents: z.number().int(),
  deadlineDays: z.number().int(),
  deadlineLabel: z.string(),
  /** Origem do cálculo: API dos Correios ou tabela de contingência. */
  source: z.enum(['correios', 'table']),
});
export type ShippingOption = z.infer<typeof ShippingOptionSchema>;

export const ShippingQuoteSchema = z.object({
  cep: z.string(),
  options: z.array(ShippingOptionSchema),
  declaredValueCents: z.number().int(),
  freeShipping: z.boolean(),
});
export type ShippingQuote = z.infer<typeof ShippingQuoteSchema>;

export const CartQuoteInputSchema = z.object({
  items: z.array(CheckoutItemSchema).min(1).max(20),
  couponCode: z.string().trim().toUpperCase().max(32).optional(),
  cep: CepSchema.optional(),
  shippingService: z.enum(SHIPPING_SERVICES).optional(),
});
export type CartQuoteInput = z.infer<typeof CartQuoteInputSchema>;

export const QuotedItemSchema = z.object({
  variantId: z.uuid(),
  productId: z.uuid(),
  productSlug: z.string(),
  name: z.string(),
  variantName: z.string(),
  sku: z.string(),
  imageUrl: z.string().nullable(),
  unitPriceCents: z.number().int(),
  quantity: z.number().int(),
  totalCents: z.number().int(),
  availableQuantity: z.number().int(),
});
export type QuotedItem = z.infer<typeof QuotedItemSchema>;

export const CartQuoteSchema = z.object({
  items: z.array(QuotedItemSchema),
  subtotalCents: z.number().int(),
  discountCents: z.number().int(),
  coupon: z
    .object({
      code: z.string(),
      description: z.string(),
      valid: z.boolean(),
      message: z.string().nullable(),
    })
    .nullable(),
  shipping: ShippingOptionSchema.nullable(),
  shippingQuote: ShippingQuoteSchema.nullable(),
  totalCents: z.number().int(),
  /** Desconto adicional aplicado quando o pagamento é por Pix (já calculado sobre o total). */
  pixDiscountCents: z.number().int(),
  installments: z.array(
    z.object({
      count: z.number().int(),
      installmentCents: z.number().int(),
      totalCents: z.number().int(),
      hasInterest: z.boolean(),
      label: z.string(),
    }),
  ),
  /** Itens que mudaram de preço ou ficaram sem estoque desde que entraram na sacola. */
  warnings: z.array(z.string()),
});
export type CartQuote = z.infer<typeof CartQuoteSchema>;

export const CheckoutInputSchema = z.object({
  items: z.array(CheckoutItemSchema).min(1, 'A sacola está vazia').max(20),
  customer: CheckoutCustomerSchema,
  shippingAddress: AddressInputSchema,
  shippingService: z.enum(SHIPPING_SERVICES, { error: 'Selecione a forma de envio' }),
  payment: z.object({
    method: z.enum(PAYMENT_METHODS, { error: 'Selecione a forma de pagamento' }),
    installments: z.number().int().min(1).max(12).default(1),
  }),
  couponCode: z.string().trim().toUpperCase().max(32).optional(),
  notes: z.string().trim().max(500).optional(),
  acceptTerms: z.literal(true, { error: 'É preciso aceitar os termos de compra' }),
  saveAddress: z.boolean().optional(),
});
export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;

export const OrderItemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid().nullable(),
  variantId: z.uuid().nullable(),
  productSlug: z.string().nullable(),
  name: z.string(),
  variantName: z.string(),
  sku: z.string(),
  imageUrl: z.string().nullable(),
  unitPriceCents: z.number().int(),
  quantity: z.number().int(),
  totalCents: z.number().int(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderEventSchema = z.object({
  id: z.uuid(),
  type: z.enum(ORDER_EVENT_TYPES),
  message: z.string(),
  createdAt: z.string(),
});
export type OrderEvent = z.infer<typeof OrderEventSchema>;

export const PaymentInstructionsSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATUSES),
  installments: z.number().int(),
  installmentCents: z.number().int(),
  pix: z
    .object({
      payload: z.string(),
      qrCodeBase64: z.string().nullable(),
      expiresAt: z.string().nullable(),
    })
    .nullable(),
  boleto: z
    .object({
      url: z.string(),
      identificationField: z.string().nullable(),
      dueDate: z.string(),
    })
    .nullable(),
  creditCard: z.object({ checkoutUrl: z.string() }).nullable(),
  paidAt: z.string().nullable(),
});
export type PaymentInstructions = z.infer<typeof PaymentInstructionsSchema>;

export const OrderSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  status: z.enum(ORDER_STATUSES),
  statusLabel: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(OrderItemSchema),
  subtotalCents: z.number().int(),
  discountCents: z.number().int(),
  shippingCents: z.number().int(),
  insuranceCents: z.number().int(),
  totalCents: z.number().int(),
  couponCode: z.string().nullable(),
  shippingService: z.enum(SHIPPING_SERVICES),
  shippingDeadlineDays: z.number().int(),
  shippingAddress: AddressInputSchema,
  customer: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    cpfMasked: z.string(),
  }),
  payment: PaymentInstructionsSchema,
  trackingCode: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  notes: z.string().nullable(),
  events: z.array(OrderEventSchema),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderSummarySchema = z.object({
  id: z.uuid(),
  number: z.string(),
  status: z.enum(ORDER_STATUSES),
  statusLabel: z.string(),
  totalCents: z.number().int(),
  itemCount: z.number().int(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  customerName: z.string(),
  customerEmail: z.string(),
  createdAt: z.string(),
});
export type OrderSummary = z.infer<typeof OrderSummarySchema>;

export const CheckoutResultSchema = z.object({
  orderId: z.uuid(),
  orderNumber: z.string(),
  /** Token de acesso do pedido para clientes sem conta (compra como visitante). */
  accessToken: z.string(),
  payment: PaymentInstructionsSchema,
});
export type CheckoutResult = z.infer<typeof CheckoutResultSchema>;

export const CepLookupSchema = z.object({
  cep: z.string(),
  street: z.string(),
  district: z.string(),
  city: z.string(),
  state: z.enum(BRAZIL_STATES),
  /** true quando o serviço de CEP estava indisponível e só o estado pôde ser inferido. */
  partial: z.boolean(),
});
export type CepLookup = z.infer<typeof CepLookupSchema>;
