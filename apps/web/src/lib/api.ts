import type {
  Address,
  AdminOrder,
  AdminOrderQuery,
  AdminProduct,
  AdminProductQuery,
  AuditLog,
  AuthStatus,
  CartQuote,
  CartQuoteInput,
  Category,
  CategoryInput,
  CepLookup,
  ChangePasswordInput,
  CheckoutInput,
  CheckoutResult,
  Collection,
  CollectionInput,
  ContactInput,
  ContactRequest,
  ContactRequestUpdate,
  ContactStatus,
  Coupon,
  CouponInput,
  CustomerDetail,
  CustomerSummary,
  DashboardStats,
  ImageUpdateInput,
  LoginInput,
  Me,
  MfaSetupResponse,
  NewsletterInput,
  NewsletterSubscriber,
  Order,
  OrderActionInput,
  OrderStatus,
  OrderSummary,
  Paginated,
  PaymentStatus,
  ProductDetail,
  ProductImage,
  ProductInput,
  ProductQuery,
  ProductSummary,
  PublicSettings,
  RegisterInput,
  SaveAddressInput,
  ShippingQuote,
  ShippingQuoteInput,
  StockAdjustInput,
  StoreSettings,
  TeamInviteInput,
  TeamInviteResult,
  TeamMember,
  UpdateProfileInput,
} from '@vellor/shared';

const BASE = '/api/v1';

/** Erro de API no formato RFC 7807 (application/problem+json). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors?: Record<string, string[]>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Primeira mensagem de erro de um campo específico, se houver. */
  fieldError(field: string): string | undefined {
    return this.errors?.[field]?.[0];
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  formData?: FormData;
}

function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const res = await fetch(`${BASE}${path}${buildQuery(options.query)}`, {
    method: options.method ?? 'GET',
    headers,
    body,
    credentials: 'same-origin',
    signal: options.signal,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const problem = (data ?? {}) as {
      code?: string;
      detail?: string;
      title?: string;
      errors?: Record<string, string[]>;
      requestId?: string;
    };
    throw new ApiError(
      res.status,
      problem.code ?? `http_${res.status}`,
      problem.detail ?? problem.title ?? 'Erro na comunicação com o servidor',
      problem.errors,
      problem.requestId,
    );
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------- Público ----------

export const settingsApi = {
  get: () => request<PublicSettings>('/settings'),
};

export const catalogApi = {
  categories: () => request<Category[]>('/catalog/categories'),
  collections: (category?: string) =>
    request<Collection[]>('/catalog/collections', { query: { category } }),
  products: (query: Partial<ProductQuery>) =>
    request<Paginated<ProductSummary>>('/catalog/products', { query: query as Query }),
  product: (slug: string) =>
    request<{ product: ProductDetail; related: ProductSummary[] }>(
      `/catalog/products/${encodeURIComponent(slug)}`,
    ),
};

export const authApi = {
  me: () => request<AuthStatus>('/auth/me'),
  login: (input: LoginInput) => request<AuthStatus>('/auth/login', { method: 'POST', body: input }),
  register: (input: RegisterInput) =>
    request<AuthStatus>('/auth/register', { method: 'POST', body: input }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    request<{ ok: true }>('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token: string, password: string) =>
    request<{ ok: true }>('/auth/reset-password', { method: 'POST', body: { token, password } }),
  changePassword: (input: ChangePasswordInput) =>
    request<{ ok: true }>('/auth/change-password', { method: 'POST', body: input }),
  updateProfile: (input: UpdateProfileInput) =>
    request<Me>('/auth/profile', { method: 'PATCH', body: input }),
  mfaSetup: () => request<MfaSetupResponse>('/auth/mfa/setup', { method: 'POST' }),
  mfaEnable: (code: string) =>
    request<AuthStatus>('/auth/mfa/enable', { method: 'POST', body: { code } }),
  mfaVerify: (code: string) =>
    request<AuthStatus>('/auth/mfa/verify', { method: 'POST', body: { code } }),
};

export const checkoutApi = {
  quote: (input: CartQuoteInput) =>
    request<CartQuote>('/checkout/quote', { method: 'POST', body: input }),
  shippingQuote: (input: ShippingQuoteInput) =>
    request<ShippingQuote>('/checkout/shipping-quote', { method: 'POST', body: input }),
  placeOrder: (input: CheckoutInput) =>
    request<CheckoutResult>('/checkout/orders', { method: 'POST', body: input }),
  cep: (cep: string) => request<CepLookup>(`/cep/${encodeURIComponent(cep.replace(/\D/g, ''))}`),
  mockConfirm: (orderId: string, accessToken?: string) =>
    request<{ ok: true }>('/payments/mock/confirm', {
      method: 'POST',
      body: { orderId, accessToken },
    }),
};

export const ordersApi = {
  get: (id: string, token?: string | null) =>
    request<Order>(`/orders/${encodeURIComponent(id)}`, { query: { t: token ?? undefined } }),
  status: (id: string, token?: string | null) =>
    request<{
      status: OrderStatus;
      statusLabel: string;
      paymentStatus: PaymentStatus;
      paidAt: string | null;
    }>(`/orders/${encodeURIComponent(id)}/status`, {
      query: { t: token ?? undefined },
    }),
};

export const accountApi = {
  orders: () => request<OrderSummary[]>('/account/orders'),
  addresses: () => request<Address[]>('/account/addresses'),
  createAddress: (input: SaveAddressInput) =>
    request<Address>('/account/addresses', { method: 'POST', body: input }),
  updateAddress: (id: string, input: SaveAddressInput) =>
    request<Address>(`/account/addresses/${id}`, { method: 'PUT', body: input }),
  deleteAddress: (id: string) =>
    request<{ ok: true }>(`/account/addresses/${id}`, { method: 'DELETE' }),
};

export const contactApi = {
  send: (input: ContactInput) => request<{ ok: true }>('/contact', { method: 'POST', body: input }),
  newsletter: (input: NewsletterInput) =>
    request<{ ok: true }>('/newsletter', { method: 'POST', body: input }),
};

// ---------- Admin ----------

export const adminApi = {
  dashboard: () => request<DashboardStats>('/admin/dashboard'),

  products: (query: Partial<AdminProductQuery>) =>
    request<Paginated<AdminProduct>>('/admin/products', { query: query as Query }),
  product: (id: string) => request<AdminProduct>(`/admin/products/${id}`),
  createProduct: (input: ProductInput) =>
    request<AdminProduct>('/admin/products', { method: 'POST', body: input }),
  updateProduct: (id: string, input: ProductInput) =>
    request<AdminProduct>(`/admin/products/${id}`, { method: 'PUT', body: input }),
  deleteProduct: (id: string) =>
    request<{ ok: true }>(`/admin/products/${id}`, { method: 'DELETE' }),
  adjustStock: (input: StockAdjustInput) =>
    request<AdminProduct>('/admin/stock/adjust', { method: 'POST', body: input }),
  uploadImage: (productId: string, file: File, meta: { alt?: string; variantId?: string } = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (meta.alt) formData.append('alt', meta.alt);
    if (meta.variantId) formData.append('variantId', meta.variantId);
    return request<ProductImage>(`/admin/products/${productId}/images`, {
      method: 'POST',
      formData,
    });
  },
  updateImage: (productId: string, imageId: string, input: ImageUpdateInput) =>
    request<ProductImage>(`/admin/products/${productId}/images/${imageId}`, {
      method: 'PATCH',
      body: input,
    }),
  reorderImages: (productId: string, imageIds: string[]) =>
    request<ProductImage[]>(`/admin/products/${productId}/images/order`, {
      method: 'PUT',
      body: { imageIds },
    }),
  deleteImage: (productId: string, imageId: string) =>
    request<{ ok: true }>(`/admin/products/${productId}/images/${imageId}`, { method: 'DELETE' }),

  categories: () => request<Category[]>('/admin/categories'),
  createCategory: (input: CategoryInput) =>
    request<Category>('/admin/categories', { method: 'POST', body: input }),
  updateCategory: (id: string, input: CategoryInput) =>
    request<Category>(`/admin/categories/${id}`, { method: 'PUT', body: input }),
  deleteCategory: (id: string) =>
    request<{ ok: true }>(`/admin/categories/${id}`, { method: 'DELETE' }),
  collections: () => request<Collection[]>('/admin/collections'),
  createCollection: (input: CollectionInput) =>
    request<Collection>('/admin/collections', { method: 'POST', body: input }),
  updateCollection: (id: string, input: CollectionInput) =>
    request<Collection>(`/admin/collections/${id}`, { method: 'PUT', body: input }),
  deleteCollection: (id: string) =>
    request<{ ok: true }>(`/admin/collections/${id}`, { method: 'DELETE' }),

  orders: (query: Partial<AdminOrderQuery>) =>
    request<Paginated<OrderSummary>>('/admin/orders', { query: query as Query }),
  order: (id: string) => request<AdminOrder>(`/admin/orders/${id}`),
  orderAction: (id: string, input: OrderActionInput) =>
    request<AdminOrder>(`/admin/orders/${id}/actions`, { method: 'POST', body: input }),

  coupons: () => request<Coupon[]>('/admin/coupons'),
  createCoupon: (input: CouponInput) =>
    request<Coupon>('/admin/coupons', { method: 'POST', body: input }),
  updateCoupon: (id: string, input: CouponInput) =>
    request<Coupon>(`/admin/coupons/${id}`, { method: 'PUT', body: input }),
  deleteCoupon: (id: string) => request<{ ok: true }>(`/admin/coupons/${id}`, { method: 'DELETE' }),

  customers: (query: { page?: number; pageSize?: number; q?: string }) =>
    request<Paginated<CustomerSummary>>('/admin/customers', { query }),
  customer: (id: string) => request<CustomerDetail>(`/admin/customers/${id}`),

  contacts: (query: { page?: number; pageSize?: number; status?: ContactStatus }) =>
    request<Paginated<ContactRequest>>('/admin/contact-requests', { query }),
  contact: (id: string) => request<ContactRequest>(`/admin/contact-requests/${id}`),
  updateContact: (id: string, input: ContactRequestUpdate) =>
    request<ContactRequest>(`/admin/contact-requests/${id}`, { method: 'PATCH', body: input }),
  newsletter: (query: { page?: number; pageSize?: number }) =>
    request<Paginated<NewsletterSubscriber>>('/admin/newsletter', { query }),
  newsletterExportUrl: `${BASE}/admin/newsletter/export.csv`,

  settings: () => request<StoreSettings>('/admin/settings'),
  updateSettings: (input: StoreSettings) =>
    request<StoreSettings>('/admin/settings', { method: 'PUT', body: input }),

  audit: (query: { page?: number; pageSize?: number; entity?: string }) =>
    request<Paginated<AuditLog>>('/admin/audit-logs', { query }),

  team: () => request<TeamMember[]>('/admin/team'),
  inviteTeamMember: (input: TeamInviteInput) =>
    request<TeamInviteResult>('/admin/team/invites', { method: 'POST', body: input }),
  resetTeamMfa: (id: string) =>
    request<{ ok: true }>(`/admin/team/${id}/reset-mfa`, { method: 'POST' }),
  revokeTeamMember: (id: string) =>
    request<{ ok: true }>(`/admin/team/${id}`, { method: 'DELETE' }),
};
