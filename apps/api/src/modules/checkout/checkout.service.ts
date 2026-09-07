import { Injectable } from '@nestjs/common';
import {
  calculateInstallments,
  type CartQuote,
  type CartQuoteInput,
  type CheckoutInput,
  type CheckoutItem,
  type CheckoutResult,
  maskCPF,
  percentOf,
  type QuotedItem,
  type ShippingOption,
  type ShippingQuote,
  type ShippingQuoteInput,
} from '@vellor/shared';
import { eq, sql } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { CryptoService } from '../../common/crypto/crypto.service';
import { ExternalServiceError, UnprocessableError } from '../../common/errors';
import { type Database, InjectDb } from '../../database/database.module';
import { addresses, orderItems, orders, productVariants, users } from '../../database/schema';
import { MetricsService } from '../../health/metrics.service';
import type { AuthContext } from '../auth/auth.types';
import { CatalogService } from '../catalog/catalog.service';
import { availableQuantity, variantPrice } from '../catalog/mappers';
import { OrdersService } from '../orders/orders.service';
import { OutboxService } from '../outbox/outbox.service';
import { PaymentsService } from '../payments/payments.service';
import { SettingsService } from '../settings/settings.service';
import { combinePackages, ShippingService } from '../shipping/shipping.service';
import { CouponsService } from './coupons.service';

type Entry = Awaited<ReturnType<CatalogService['findVariantsForCheckout']>>[number];

interface ResolvedItems {
  quoted: QuotedItem[];
  entries: Map<string, Entry>;
  missing: string[];
  warnings: string[];
}

@Injectable()
export class CheckoutService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly catalog: CatalogService,
    private readonly shipping: ShippingService,
    private readonly coupons: CouponsService,
    private readonly payments: PaymentsService,
    private readonly orders: OrdersService,
    private readonly settings: SettingsService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly metrics: MetricsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CheckoutService.name);
  }

  private async resolveItems(items: CheckoutItem[]): Promise<ResolvedItems> {
    const merged = new Map<string, number>();
    for (const item of items)
      merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);
    const found = await this.catalog.findVariantsForCheckout([...merged.keys()]);
    const entries = new Map(found.map((entry) => [entry.variant.id, entry]));
    const quoted: QuotedItem[] = [];
    const missing: string[] = [];
    const warnings: string[] = [];
    for (const [variantId, quantity] of merged) {
      const entry = entries.get(variantId);
      if (!entry) {
        missing.push(variantId);
        continue;
      }
      const { variant, product } = entry;
      const available = availableQuantity(variant);
      const unit = variantPrice(variant, product);
      const image = [...product.images].sort((a, b) => a.position - b.position);
      const variantImage = image.find((i) => i.id === variant.imageId) ?? image[0];
      if (available < quantity) {
        warnings.push(
          available === 0
            ? `${product.name} (${variant.name}) esgotou.`
            : `${product.name} (${variant.name}): só ${available} unidade(s) disponível(is).`,
        );
      }
      quoted.push({
        variantId,
        productId: product.id,
        productSlug: product.slug,
        name: product.name,
        variantName: variant.name,
        sku: variant.sku,
        imageUrl: variantImage?.url ?? null,
        unitPriceCents: unit,
        quantity,
        totalCents: unit * quantity,
        availableQuantity: available,
      });
    }
    return { quoted, entries, missing, warnings };
  }

  private packageFor(quoted: QuotedItem[], entries: Map<string, Entry>) {
    return combinePackages(
      quoted.map((q) => {
        const product = entries.get(q.variantId)!.product;
        return {
          quantity: q.quantity,
          weightGrams: product.weightGrams,
          lengthCm: product.lengthCm,
          widthCm: product.widthCm,
          heightCm: product.heightCm,
        };
      }),
    );
  }

  async shippingQuote(input: ShippingQuoteInput): Promise<ShippingQuote> {
    const { quoted, entries, missing } = await this.resolveItems(input.items);
    if (!quoted.length)
      throw new UnprocessableError('Nenhum item válido para cotação', 'items_unavailable', {
        items: missing,
      });
    const subtotal = quoted.reduce((sum, q) => sum + q.totalCents, 0);
    return this.shipping.quote({
      destinationCep: input.cep,
      declaredValueCents: subtotal,
      subtotalCents: subtotal,
      pkg: this.packageFor(quoted, entries),
    });
  }

  async quote(input: CartQuoteInput, auth?: AuthContext): Promise<CartQuote> {
    const { quoted, entries, missing, warnings } = await this.resolveItems(input.items);
    if (missing.length)
      warnings.push('Alguns itens da sacola não estão mais disponíveis e foram ignorados.');
    const settings = await this.settings.get();
    const subtotalCents = quoted.reduce((sum, q) => sum + q.totalCents, 0);

    let discountCents = 0;
    let coupon: CartQuote['coupon'] = null;
    if (input.couponCode) {
      const result = await this.coupons.validate(input.couponCode, subtotalCents, auth?.user.email);
      coupon = result.valid
        ? { code: result.coupon.code, description: result.description, valid: true, message: null }
        : { code: input.couponCode, description: '', valid: false, message: result.message };
      if (result.valid) discountCents = result.discountCents;
    }

    let shippingQuote: ShippingQuote | null = null;
    let shipping: ShippingOption | null = null;
    if (input.cep && quoted.length) {
      shippingQuote = await this.shipping.quote({
        destinationCep: input.cep,
        declaredValueCents: subtotalCents - discountCents,
        subtotalCents,
        pkg: this.packageFor(quoted, entries),
      });
      shipping =
        shippingQuote.options.find((o) => o.service === input.shippingService) ??
        shippingQuote.options[0] ??
        null;
    }

    const totalCents = Math.max(0, subtotalCents - discountCents) + (shipping?.totalCents ?? 0);
    const pixDiscountCents = percentOf(
      Math.max(0, subtotalCents - discountCents),
      settings.payments.pixDiscountPercent,
    );
    const installments = calculateInstallments(totalCents, settings.payments);
    return {
      items: quoted,
      subtotalCents,
      discountCents,
      coupon,
      shipping,
      shippingQuote,
      totalCents,
      pixDiscountCents,
      installments,
      warnings,
    };
  }

  async placeOrder(
    input: CheckoutInput,
    auth: AuthContext | undefined,
    meta: { ip?: string | null },
  ): Promise<CheckoutResult> {
    const { quoted, entries, missing } = await this.resolveItems(input.items);
    if (missing.length || !quoted.length) {
      throw new UnprocessableError(
        'Alguns itens da sacola não estão mais disponíveis',
        'items_unavailable',
        { items: missing },
      );
    }
    const settings = await this.settings.get();
    const subtotalCents = quoted.reduce((sum, q) => sum + q.totalCents, 0);

    let couponId: string | null = null;
    let couponCode: string | null = null;
    let discountCents = 0;
    if (input.couponCode) {
      const result = await this.coupons.validate(
        input.couponCode,
        subtotalCents,
        input.customer.email,
      );
      if (!result.valid)
        throw new UnprocessableError(result.message, 'invalid_coupon', {
          couponCode: [result.message],
        });
      couponId = result.coupon.id;
      couponCode = result.coupon.code;
      discountCents = result.discountCents;
    }

    const shippingQuote = await this.shipping.quote({
      destinationCep: input.shippingAddress.cep,
      declaredValueCents: subtotalCents - discountCents,
      subtotalCents,
      pkg: this.packageFor(quoted, entries),
    });
    const shippingOption = shippingQuote.options.find((o) => o.service === input.shippingService);
    if (!shippingOption)
      throw new UnprocessableError(
        'Forma de envio indisponível para este CEP',
        'shipping_unavailable',
        { shippingService: ['Indisponível'] },
      );

    const pixDiscountCents =
      input.payment.method === 'pix'
        ? percentOf(
            Math.max(0, subtotalCents - discountCents),
            settings.payments.pixDiscountPercent,
          )
        : 0;
    const totalCents =
      Math.max(0, subtotalCents - discountCents - pixDiscountCents) + shippingOption.totalCents;
    if (totalCents <= 0) throw new UnprocessableError('Total do pedido inválido', 'invalid_total');

    let installments = 1;
    let installmentCents = totalCents;
    if (input.payment.method === 'credit_card') {
      const option = calculateInstallments(totalCents, settings.payments).find(
        (o) => o.count === input.payment.installments,
      );
      if (!option)
        throw new UnprocessableError(
          'Parcelamento indisponível para este valor',
          'invalid_installments',
          { installments: ['Escolha outra quantidade de parcelas'] },
        );
      installments = option.count;
      installmentCents = option.installmentCents;
    }

    const accessToken = this.crypto.randomToken(24);
    const userId = auth?.user.id ?? null;

    const created = await this.db.transaction(async (tx) => {
      for (const item of quoted) {
        const [variant] = await tx
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, item.variantId))
          .for('update');
        if (!variant || !variant.isActive)
          throw new UnprocessableError(
            `${item.name} não está mais disponível`,
            'items_unavailable',
          );
        const available = variant.stockQuantity - variant.reservedQuantity;
        if (available < item.quantity) {
          throw new UnprocessableError(
            available > 0
              ? `Só ${available} unidade(s) de ${item.name} (${item.variantName}) disponível(is)`
              : `${item.name} (${item.variantName}) esgotou`,
            'insufficient_stock',
            { items: [item.variantId] },
          );
        }
        await tx
          .update(productVariants)
          .set({
            reservedQuantity: variant.reservedQuantity + item.quantity,
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, variant.id));
      }
      if (couponId) await this.coupons.consume(couponId, tx);

      const seq = await tx.execute<{ next: string | number }>(
        sql`select nextval('order_number_seq') as next`,
      );
      const number = `VL-${String(seq[0]?.next ?? Date.now())}`;

      const [order] = await tx
        .insert(orders)
        .values({
          number,
          userId,
          status: 'pending_payment',
          customerName: input.customer.name,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone,
          customerCpfEncrypted: this.crypto.encrypt(input.customer.cpf),
          customerCpfMasked: maskCPF(input.customer.cpf),
          shippingAddress: {
            ...input.shippingAddress,
            recipientName: input.shippingAddress.recipientName ?? input.customer.name,
          },
          shippingService: shippingOption.service,
          shippingDeadlineDays: shippingOption.deadlineDays,
          shippingCents: shippingOption.freightCents,
          insuranceCents: shippingOption.insuranceCents,
          subtotalCents,
          discountCents: discountCents + pixDiscountCents,
          totalCents,
          couponId,
          couponCode,
          paymentMethod: input.payment.method,
          paymentStatus: 'pending',
          installments,
          installmentCents,
          providerName: this.payments.mock ? 'mock' : 'asaas',
          accessTokenHash: this.crypto.sha256(accessToken),
          notes: input.notes ?? null,
        })
        .returning({ id: orders.id, number: orders.number });

      await tx.insert(orderItems).values(
        quoted.map((q) => ({
          orderId: order!.id,
          productId: q.productId,
          variantId: q.variantId,
          productSlug: q.productSlug,
          name: q.name,
          variantName: q.variantName,
          sku: q.sku,
          imageUrl: q.imageUrl,
          unitPriceCents: q.unitPriceCents,
          quantity: q.quantity,
          totalCents: q.totalCents,
          weightGrams: entries.get(q.variantId)!.product.weightGrams,
        })),
      );
      await this.orders.addEvent(
        order!.id,
        'created',
        `Pedido criado (${quoted.length} item(ns))`,
        tx,
        userId,
      );
      return order!;
    });

    let charge;
    try {
      charge = await this.payments.createCharge({
        orderId: created.id,
        orderNumber: created.number,
        method: input.payment.method,
        totalCents,
        installments,
        installmentCents,
        customer: {
          name: input.customer.name,
          email: input.customer.email,
          cpf: input.customer.cpf,
          phone: input.customer.phone,
          existingProviderCustomerId: auth?.user.providerCustomerId ?? null,
        },
        address: input.shippingAddress,
        boletoDueDays: settings.payments.boletoDueDays,
        pixExpirationMinutes: settings.payments.pixExpirationMinutes,
      });
    } catch (error) {
      this.logger.error(
        { err: error, orderId: created.id },
        'Falha ao criar cobrança; pedido será cancelado',
      );
      await this.orders
        .cancel(created.id, null, 'Falha ao gerar a cobrança no provedor de pagamento')
        .catch(() => undefined);
      throw error instanceof ExternalServiceError
        ? error
        : new ExternalServiceError('Não foi possível gerar a cobrança. Tente novamente.');
    }

    await this.db
      .update(orders)
      .set({
        providerName: charge.providerName,
        providerCustomerId: charge.providerCustomerId,
        providerPaymentId: charge.providerPaymentId,
        providerInvoiceUrl: charge.invoiceUrl,
        paymentStatus: charge.status,
        pixPayload: charge.pix?.payload ?? null,
        pixQrCodeBase64: charge.pix?.qrCodeBase64 ?? null,
        pixExpiresAt: charge.pix?.expiresAt ?? null,
        boletoUrl: charge.boleto?.url ?? null,
        boletoIdentificationField: charge.boleto?.identificationField ?? null,
        boletoDueDate: charge.boleto?.dueDate ?? null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, created.id));
    await this.orders.addEvent(created.id, 'payment_pending', 'Aguardando pagamento');
    await this.outbox.enqueue('email.order_created', { orderId: created.id, accessToken });
    this.metrics.ordersCreated.inc({ payment_method: input.payment.method });

    if (auth) {
      if (!auth.user.providerCustomerId && charge.providerName === 'asaas') {
        await this.db
          .update(users)
          .set({ providerCustomerId: charge.providerCustomerId })
          .where(eq(users.id, auth.user.id));
      }
      if (input.saveAddress) await this.saveAddress(auth.user.id, input);
    }

    if (charge.status === 'received' || charge.status === 'confirmed') {
      await this.orders.markPaid(
        created.id,
        new Date(),
        charge.providerName === 'mock' ? 'mock' : 'asaas',
        charge.status,
      );
    }

    const order = await this.orders.getById(created.id);
    return {
      orderId: created.id,
      orderNumber: created.number,
      accessToken,
      payment: order!.payment,
    };
  }

  private async saveAddress(userId: string, input: CheckoutInput): Promise<void> {
    const a = input.shippingAddress;
    const existing = await this.db.query.addresses.findMany({
      where: eq(addresses.userId, userId),
    });
    const duplicate = existing.find(
      (e) => e.cep === a.cep && e.number === a.number && e.street === a.street,
    );
    if (duplicate) return;
    await this.db.insert(addresses).values({
      userId,
      label: existing.length ? null : 'Principal',
      recipientName: a.recipientName ?? input.customer.name,
      cep: a.cep,
      street: a.street,
      number: a.number,
      complement: a.complement ?? null,
      district: a.district,
      city: a.city,
      state: a.state,
      reference: a.reference ?? null,
      isDefault: existing.length === 0,
    });
  }
}
