/**
 * Enumerações de domínio compartilhadas entre API e clientes.
 * Os rótulos em pt-BR ficam aqui para que loja e admin exibam sempre o mesmo texto.
 */

export const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Aguardando pagamento',
  paid: 'Pagamento confirmado',
  processing: 'Em separação',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

export const PAYMENT_METHODS = ['pix', 'boleto', 'credit_card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  boleto: 'Boleto bancário',
  credit_card: 'Cartão de crédito',
};

export const PAYMENT_STATUSES = [
  'pending',
  'confirmed',
  'received',
  'overdue',
  'refunded',
  'cancelled',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  received: 'Recebido',
  overdue: 'Vencido',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
};

export const USER_ROLES = ['customer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CATEGORY_KINDS = ['watch', 'perfume', 'other'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  watch: 'Relógios',
  perfume: 'Perfumes de nicho',
  other: 'Outros',
};

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Rascunho',
  active: 'Publicado',
  archived: 'Arquivado',
};

export const COUPON_TYPES = ['percent', 'fixed'] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const SHIPPING_SERVICES = ['PAC', 'SEDEX'] as const;
export type ShippingService = (typeof SHIPPING_SERVICES)[number];

export const SHIPPING_SERVICE_LABELS: Record<ShippingService, string> = {
  PAC: 'Correios PAC (com seguro)',
  SEDEX: 'Correios SEDEX (com seguro)',
};

export const CONTACT_STATUSES = ['new', 'in_progress', 'answered', 'closed'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'Novo',
  in_progress: 'Em atendimento',
  answered: 'Respondido',
  closed: 'Encerrado',
};

export const CONTACT_SUBJECTS = ['duvida', 'compra', 'pos_venda', 'outro'] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export const CONTACT_SUBJECT_LABELS: Record<ContactSubject, string> = {
  duvida: 'Dúvida sobre um produto',
  compra: 'Quero comprar / consultoria',
  pos_venda: 'Pós-venda (pedido, troca, garantia)',
  outro: 'Outro assunto',
};

export const BRAZIL_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
export type BrazilState = (typeof BRAZIL_STATES)[number];

export const ORDER_EVENT_TYPES = [
  'created',
  'payment_pending',
  'payment_confirmed',
  'payment_overdue',
  'payment_refunded',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'note',
] as const;
export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];
