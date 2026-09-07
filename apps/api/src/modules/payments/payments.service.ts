import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  type AddressInput,
  centsToDecimal,
  type PaymentMethod,
  type PaymentStatus,
} from '@vellor/shared';
import { PinoLogger } from 'nestjs-pino';
import QRCode from 'qrcode';
import { AppConfig } from '../../config/app-config';
import { type AsaasBillingType, AsaasClient } from './asaas.client';

export interface ChargeCustomer {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  existingProviderCustomerId?: string | null;
}

export interface CreateChargeInput {
  orderId: string;
  orderNumber: string;
  method: PaymentMethod;
  totalCents: number;
  installments: number;
  installmentCents: number;
  customer: ChargeCustomer;
  address: AddressInput;
  boletoDueDays: number;
  pixExpirationMinutes: number;
}

export interface ChargeResult {
  providerName: 'asaas' | 'mock';
  providerCustomerId: string;
  providerPaymentId: string;
  invoiceUrl: string | null;
  status: PaymentStatus;
  pix: { payload: string; qrCodeBase64: string | null; expiresAt: Date | null } | null;
  boleto: { url: string; identificationField: string | null; dueDate: string } | null;
  creditCard: { checkoutUrl: string } | null;
}

const BILLING_TYPES: Record<PaymentMethod, AsaasBillingType> = {
  pix: 'PIX',
  boleto: 'BOLETO',
  credit_card: 'CREDIT_CARD',
};

/** Converte o status do Asaas para o status interno de pagamento. */
export function mapAsaasStatus(status: string): PaymentStatus {
  switch (status) {
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH':
      return 'received';
    case 'CONFIRMED':
      return 'confirmed';
    case 'OVERDUE':
      return 'overdue';
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'REFUND_IN_PROGRESS':
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
    case 'AWAITING_CHARGEBACK_REVERSAL':
      return 'refunded';
    case 'DELETED':
      return 'cancelled';
    case 'PENDING':
    case 'AWAITING_RISK_ANALYSIS':
    default:
      return 'pending';
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Cria cobranças no Asaas (ou simuladas, sem chave configurada). */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly asaas: AsaasClient,
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(PaymentsService.name);
  }

  get mock(): boolean {
    return this.config.paymentsMock;
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    return this.mock ? this.createMockCharge(input) : this.createAsaasCharge(input);
  }

  private async createAsaasCharge(input: CreateChargeInput): Promise<ChargeResult> {
    let customerId = input.customer.existingProviderCustomerId ?? null;
    if (!customerId) {
      const existing = await this.asaas.findCustomerByCpf(input.customer.cpf);
      customerId = existing?.id ?? null;
    }
    if (!customerId) {
      const created = await this.asaas.createCustomer({
        name: input.customer.name,
        email: input.customer.email,
        cpfCnpj: input.customer.cpf,
        mobilePhone: input.customer.phone,
        postalCode: input.address.cep,
        address: input.address.street,
        addressNumber: input.address.number,
        complement: input.address.complement ?? undefined,
        province: input.address.district,
        externalReference: input.customer.email,
        notificationDisabled: true,
      });
      customerId = created.id;
    }

    const now = new Date();
    const dueDate =
      input.method === 'boleto'
        ? isoDate(new Date(now.getTime() + input.boletoDueDays * 86_400_000))
        : input.method === 'pix'
          ? isoDate(
              new Date(
                now.getTime() +
                  Math.max(1, Math.ceil(input.pixExpirationMinutes / 1440)) * 86_400_000,
              ),
            )
          : isoDate(new Date(now.getTime() + 2 * 86_400_000));

    const payment = await this.asaas.createPayment({
      customer: customerId,
      billingType: BILLING_TYPES[input.method],
      value: centsToDecimal(input.totalCents),
      dueDate,
      description: `Pedido ${input.orderNumber} - Vellor`,
      externalReference: input.orderId,
      ...(input.method === 'credit_card' && input.installments > 1
        ? {
            installmentCount: input.installments,
            installmentValue: centsToDecimal(input.installmentCents),
          }
        : {}),
    });

    const result: ChargeResult = {
      providerName: 'asaas',
      providerCustomerId: customerId,
      providerPaymentId: payment.id,
      invoiceUrl: payment.invoiceUrl ?? null,
      status: mapAsaasStatus(payment.status),
      pix: null,
      boleto: null,
      creditCard: null,
    };

    if (input.method === 'pix') {
      const qr = await this.asaas.getPixQrCode(payment.id);
      result.pix = {
        payload: qr.payload,
        qrCodeBase64: qr.encodedImage,
        expiresAt: qr.expirationDate
          ? new Date(qr.expirationDate)
          : new Date(now.getTime() + input.pixExpirationMinutes * 60_000),
      };
    } else if (input.method === 'boleto') {
      let identificationField: string | null = null;
      try {
        identificationField = (await this.asaas.getIdentificationField(payment.id))
          .identificationField;
      } catch (error) {
        this.logger.warn(
          { err: error, paymentId: payment.id },
          'Linha digitável indisponível; usando apenas o link do boleto',
        );
      }
      result.boleto = {
        url: payment.bankSlipUrl ?? payment.invoiceUrl ?? '',
        identificationField,
        dueDate,
      };
    } else {
      result.creditCard = { checkoutUrl: payment.invoiceUrl ?? '' };
    }
    return result;
  }

  private async createMockCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const now = new Date();
    const paymentId = `mock_${randomUUID()}`;
    const orderUrl = `${this.config.env.APP_URL}/pedido/${input.orderId}`;
    const result: ChargeResult = {
      providerName: 'mock',
      providerCustomerId:
        input.customer.existingProviderCustomerId ?? `mock_cus_${input.customer.cpf.slice(-4)}`,
      providerPaymentId: paymentId,
      invoiceUrl: `${orderUrl}?simular=1`,
      status: 'pending',
      pix: null,
      boleto: null,
      creditCard: null,
    };
    if (input.method === 'pix') {
      const payload = `00020126580014BR.GOV.BCB.PIX0136SIMULADO-${input.orderNumber}5204000053039865406${centsToDecimal(input.totalCents).toFixed(2)}5802BR5906VELLOR6009SAO PAULO62070503***6304ABCD`;
      const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 280 });
      result.pix = {
        payload,
        qrCodeBase64: dataUrl.replace(/^data:image\/png;base64,/, ''),
        expiresAt: new Date(now.getTime() + input.pixExpirationMinutes * 60_000),
      };
    } else if (input.method === 'boleto') {
      result.boleto = {
        url: `${orderUrl}?simular=1&boleto=1`,
        identificationField: '00000.00000 00000.000000 00000.000000 0 00000000000000',
        dueDate: isoDate(new Date(now.getTime() + input.boletoDueDays * 86_400_000)),
      };
    } else {
      result.creditCard = { checkoutUrl: `${orderUrl}?simular=1&cartao=1` };
    }
    return result;
  }

  /** Cancela a cobrança no provedor (melhor esforço; nunca derruba o fluxo do pedido). */
  async cancelCharge(providerName: string, providerPaymentId: string | null): Promise<void> {
    if (!providerPaymentId || providerName !== 'asaas' || this.mock) return;
    try {
      await this.asaas.deletePayment(providerPaymentId);
    } catch (error) {
      this.logger.warn(
        { err: error, providerPaymentId },
        'Não foi possível cancelar a cobrança no Asaas',
      );
    }
  }
}
