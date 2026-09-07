import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { coupons, orders, productVariants } from '../src/database/schema';
import {
  agent,
  firstVariants,
  loginAdmin,
  resetDatabase,
  startApp,
  type TestContext,
  VALID_ADDRESS,
  VALID_CUSTOMER,
} from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startApp();
});

afterAll(async () => {
  await ctx.app.close();
});

beforeEach(async () => {
  await resetDatabase(ctx);
});

function checkoutBody(
  items: Array<{ variantId: string; quantity: number }>,
  overrides: Record<string, unknown> = {},
) {
  return {
    items,
    customer: VALID_CUSTOMER,
    shippingAddress: VALID_ADDRESS,
    shippingService: 'SEDEX',
    payment: { method: 'pix', installments: 1 },
    acceptTerms: true,
    ...overrides,
  };
}

describe('cotação da sacola', () => {
  it('calcula cupom, frete com seguro e parcelas', async () => {
    const [a, b] = await firstVariants(ctx, 2);
    const res = await agent(ctx).post('/api/v1/checkout/quote', {
      items: [
        { variantId: a!.id, quantity: 1 },
        { variantId: b!.id, quantity: 1 },
      ],
      couponCode: 'BEMVINDO10',
      cep: '01310-100',
      shippingService: 'PAC',
    });
    expect(res.status).toBe(200);
    const subtotal = a!.priceCents + b!.priceCents;
    expect(res.body.subtotalCents).toBe(subtotal);
    expect(res.body.coupon.valid).toBe(true);
    expect(res.body.discountCents).toBe(Math.floor(subtotal / 10));
    expect(res.body.shipping.service).toBe('PAC');
    expect(res.body.shipping.insuranceCents).toBeGreaterThan(0);
    expect(res.body.shipping.source).toBe('table');
    expect(res.body.totalCents).toBe(
      subtotal - res.body.discountCents + res.body.shipping.totalCents,
    );
    expect(res.body.installments[0].count).toBe(1);
  });

  it('avisa quando a quantidade pedida supera o estoque', async () => {
    const [a] = await firstVariants(ctx, 1);
    const res = await agent(ctx).post('/api/v1/checkout/quote', {
      items: [{ variantId: a!.id, quantity: 10 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.warnings.length).toBeGreaterThan(0);
    expect(res.body.items[0].availableQuantity).toBe(a!.availableQuantity);
  });
});

describe('criação de pedido', () => {
  it('cria pedido Pix como visitante, reserva estoque e confirma pagamento simulado', async () => {
    const [a] = await firstVariants(ctx, 1);
    const anon = agent(ctx);
    const created = await anon.post(
      '/api/v1/checkout/orders',
      checkoutBody([{ variantId: a!.id, quantity: 1 }], { couponCode: 'BEMVINDO10' }),
    );
    expect(created.status).toBe(201);
    expect(created.body.orderNumber).toMatch(/^VL-\d+$/);
    expect(created.body.payment.pix.payload).toContain('SIMULADO');

    const variant = await ctx.db.db.query.productVariants.findFirst({
      where: eq(productVariants.id, a!.id),
    });
    expect(variant!.reservedQuantity).toBe(1);

    const coupon = await ctx.db.db.query.coupons.findFirst({
      where: eq(coupons.code, 'BEMVINDO10'),
    });
    expect(coupon!.usesCount).toBe(1);

    const withoutToken = await anon.get(`/api/v1/orders/${created.body.orderId}`);
    expect(withoutToken.status).toBe(404);

    const order = await anon.get(
      `/api/v1/orders/${created.body.orderId}?t=${encodeURIComponent(created.body.accessToken)}`,
    );
    expect(order.status).toBe(200);
    expect(order.body.status).toBe('pending_payment');
    expect(order.body.customer.cpfMasked).toMatch(/^\*\*\*\./);

    const confirm = await anon.post('/api/v1/payments/mock/confirm', {
      orderId: created.body.orderId,
      accessToken: created.body.accessToken,
    });
    expect(confirm.status).toBe(200);

    const paid = await anon.get(
      `/api/v1/orders/${created.body.orderId}/status?t=${encodeURIComponent(created.body.accessToken)}`,
    );
    expect(paid.body.status).toBe('paid');

    const committed = await ctx.db.db.query.productVariants.findFirst({
      where: eq(productVariants.id, a!.id),
    });
    expect(committed!.reservedQuantity).toBe(0);
    expect(committed!.stockQuantity).toBe(variant!.stockQuantity - 1);

    const row = await ctx.db.db.query.orders.findFirst({
      where: eq(orders.id, created.body.orderId),
    });
    expect(row!.stockCommitted).toBe(true);
    expect(row!.discountCents).toBeGreaterThan(0);
  });

  it('recusa pedido acima do estoque disponível e não deixa reserva pendurada', async () => {
    const [a] = await firstVariants(ctx, 1);
    const res = await agent(ctx).post(
      '/api/v1/checkout/orders',
      checkoutBody([{ variantId: a!.id, quantity: a!.availableQuantity + 1 }]),
    );
    expect(res.status).toBe(422);
    expect(['insufficient_stock', 'items_unavailable']).toContain(res.body.code);
    const variant = await ctx.db.db.query.productVariants.findFirst({
      where: eq(productVariants.id, a!.id),
    });
    expect(variant!.reservedQuantity).toBe(0);
  });

  it('valida CPF, aceite de termos e parcelamento', async () => {
    const [a] = await firstVariants(ctx, 1);
    const badCpf = await agent(ctx).post(
      '/api/v1/checkout/orders',
      checkoutBody([{ variantId: a!.id, quantity: 1 }], {
        customer: { ...VALID_CUSTOMER, cpf: '111.111.111-11' },
      }),
    );
    expect(badCpf.status).toBe(400);
    expect(badCpf.body.errors['customer.cpf']).toBeDefined();

    const noTerms = await agent(ctx).post(
      '/api/v1/checkout/orders',
      checkoutBody([{ variantId: a!.id, quantity: 1 }], { acceptTerms: false }),
    );
    expect(noTerms.status).toBe(400);

    const tooManyInstallments = await agent(ctx).post(
      '/api/v1/checkout/orders',
      checkoutBody([{ variantId: a!.id, quantity: 1 }], {
        payment: { method: 'credit_card', installments: 12 },
      }),
    );
    // pode ser aceito ou recusado conforme o valor mínimo da parcela; nunca deve ser erro 5xx
    expect([201, 422]).toContain(tooManyInstallments.status);
  });

  it('vincula o pedido ao cliente logado e lista na conta', async () => {
    const [a] = await firstVariants(ctx, 1);
    const customer = agent(ctx);
    await customer.post('/api/v1/auth/register', {
      name: 'Cliente Logado',
      email: 'logado@teste.local',
      password: 'SenhaForte#2026',
      acceptTerms: true,
    });
    const created = await customer.post(
      '/api/v1/checkout/orders',
      checkoutBody([{ variantId: a!.id, quantity: 1 }], {
        saveAddress: true,
        payment: { method: 'boleto', installments: 1 },
      }),
    );
    expect(created.status).toBe(201);
    expect(created.body.payment.boleto.url).toBeTruthy();

    const mine = await customer.get('/api/v1/account/orders');
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].id).toBe(created.body.orderId);

    const noToken = await customer.get(`/api/v1/orders/${created.body.orderId}`);
    expect(noToken.status).toBe(200);

    const addresses = await customer.get('/api/v1/account/addresses');
    expect(addresses.body).toHaveLength(1);
    expect(addresses.body[0].isDefault).toBe(true);
  });
});

describe('gestão de pedidos no admin', () => {
  it('aplica transições, exige rastreio no envio e devolve estoque no cancelamento', async () => {
    const [a] = await firstVariants(ctx, 1);
    const anon = agent(ctx);
    const created = await anon.post(
      '/api/v1/checkout/orders',
      checkoutBody([{ variantId: a!.id, quantity: 1 }]),
    );
    await anon.post('/api/v1/payments/mock/confirm', {
      orderId: created.body.orderId,
      accessToken: created.body.accessToken,
    });

    const admin = await loginAdmin(ctx);
    const list = await admin.get('/api/v1/admin/orders?status=paid');
    expect(list.body.items.map((o: { id: string }) => o.id)).toContain(created.body.orderId);

    const noTracking = await admin.post(`/api/v1/admin/orders/${created.body.orderId}/actions`, {
      action: 'mark_shipped',
    });
    expect(noTracking.status).toBe(422);

    const processing = await admin.post(`/api/v1/admin/orders/${created.body.orderId}/actions`, {
      action: 'mark_processing',
    });
    expect(processing.body.status).toBe('processing');

    const shipped = await admin.post(`/api/v1/admin/orders/${created.body.orderId}/actions`, {
      action: 'mark_shipped',
      trackingCode: 'AA123456789BR',
    });
    expect(shipped.body.status).toBe('shipped');
    expect(shipped.body.trackingUrl).toContain('AA123456789BR');

    const invalid = await admin.post(`/api/v1/admin/orders/${created.body.orderId}/actions`, {
      action: 'mark_processing',
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('invalid_transition');

    const second = await anon.post(
      '/api/v1/checkout/orders',
      checkoutBody([{ variantId: a!.id, quantity: 1 }]),
    );
    expect(second.status).toBe(201);
    const before = await ctx.db.db.query.productVariants.findFirst({
      where: eq(productVariants.id, a!.id),
    });
    const cancelled = await admin.post(`/api/v1/admin/orders/${second.body.orderId}/actions`, {
      action: 'cancel',
      note: 'Cliente desistiu',
    });
    expect(cancelled.body.status).toBe('cancelled');
    const after = await ctx.db.db.query.productVariants.findFirst({
      where: eq(productVariants.id, a!.id),
    });
    expect(after!.reservedQuantity).toBe(before!.reservedQuantity - 1);

    const audit = await admin.get('/api/v1/admin/audit-logs?entity=order');
    expect(audit.body.items.some((e: { action: string }) => e.action === 'order.cancel')).toBe(
      true,
    );
  });
});

describe('webhook do Asaas', () => {
  it('rejeita token inválido e processa evento de pagamento confirmado uma única vez', async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'token-de-teste';
    const [a] = await firstVariants(ctx, 1);
    const anon = agent(ctx);
    const created = await anon.post(
      '/api/v1/checkout/orders',
      checkoutBody([{ variantId: a!.id, quantity: 1 }]),
    );
    const row = await ctx.db.db.query.orders.findFirst({
      where: eq(orders.id, created.body.orderId),
    });

    const unauthorized = await agent(ctx).post('/api/v1/webhooks/asaas', {
      event: 'PAYMENT_RECEIVED',
      payment: { id: row!.providerPaymentId, status: 'RECEIVED' },
    });
    expect(unauthorized.status).toBe(401);

    const config = ctx.app.get((await import('../src/config/app-config')).AppConfig);
    (config.env as { ASAAS_WEBHOOK_TOKEN?: string }).ASAAS_WEBHOOK_TOKEN = 'token-de-teste';
    const payload = {
      id: 'evt_1',
      event: 'PAYMENT_RECEIVED',
      payment: { id: row!.providerPaymentId, status: 'RECEIVED', externalReference: row!.id },
    };
    const first = await agent(ctx)
      .post('/api/v1/webhooks/asaas', payload)
      .set('asaas-access-token', 'token-de-teste');
    expect(first.status).toBe(200);
    expect(first.body.received).toBe(true);
    const duplicate = await agent(ctx)
      .post('/api/v1/webhooks/asaas', payload)
      .set('asaas-access-token', 'token-de-teste');
    expect(duplicate.body.duplicate).toBe(true);

    const status = await anon.get(
      `/api/v1/orders/${created.body.orderId}/status?t=${encodeURIComponent(created.body.accessToken)}`,
    );
    expect(status.body.status).toBe('paid');
  });
});
