import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ExternalServiceError } from '../../common/errors';
import { AppConfig } from '../../config/app-config';

/** Subconjunto da API v3 do Asaas usado pela loja (https://docs.asaas.com). */

export type AsaasBillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';

export interface AsaasCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  cpfCnpj?: string;
}

export interface AsaasPaymentInput {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
}

export interface AsaasPayment {
  id: string;
  status: string;
  billingType: AsaasBillingType;
  value: number;
  netValue?: number;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  externalReference?: string;
  customer: string;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  installment?: string | null;
}

export interface AsaasPixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export interface AsaasIdentificationField {
  identificationField: string;
  nossoNumero?: string;
  barCode?: string;
}

const TIMEOUT_MS = 12_000;

@Injectable()
export class AsaasClient {
  private readonly baseUrl: string;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AsaasClient.name);
    this.baseUrl =
      config.env.ASAAS_API_URL ??
      (config.env.ASAAS_ENV === 'production'
        ? 'https://api.asaas.com/v3'
        : 'https://api-sandbox.asaas.com/v3');
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const apiKey = this.config.env.ASAAS_API_KEY;
    if (!apiKey) throw new ExternalServiceError('Asaas não configurado', 'asaas_not_configured');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          access_token: apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Vellor/1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      const data = text ? (JSON.parse(text) as unknown) : {};
      if (!res.ok) {
        const description =
          (data as { errors?: Array<{ description?: string; code?: string }> })?.errors?.[0]
            ?.description ?? `HTTP ${res.status}`;
        this.logger.error({ path, status: res.status, description }, 'Erro na API do Asaas');
        throw new ExternalServiceError(
          `Erro no provedor de pagamento: ${description}`,
          'asaas_error',
        );
      }
      return data as T;
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      this.logger.error({ err: error, path }, 'Falha de comunicação com o Asaas');
      throw new ExternalServiceError(
        'Não foi possível falar com o provedor de pagamento. Tente novamente.',
        'asaas_unreachable',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async findCustomerByCpf(cpfCnpj: string): Promise<AsaasCustomer | null> {
    const data = await this.request<{ data?: AsaasCustomer[] }>(
      'GET',
      `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`,
    );
    return data.data?.[0] ?? null;
  }

  createCustomer(input: AsaasCustomerInput): Promise<AsaasCustomer> {
    return this.request<AsaasCustomer>('POST', '/customers', {
      notificationDisabled: true,
      ...input,
    });
  }

  createPayment(input: AsaasPaymentInput): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('POST', '/payments', { postalService: false, ...input });
  }

  getPayment(id: string): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('GET', `/payments/${encodeURIComponent(id)}`);
  }

  getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
    return this.request<AsaasPixQrCode>(
      'GET',
      `/payments/${encodeURIComponent(paymentId)}/pixQrCode`,
    );
  }

  getIdentificationField(paymentId: string): Promise<AsaasIdentificationField> {
    return this.request<AsaasIdentificationField>(
      'GET',
      `/payments/${encodeURIComponent(paymentId)}/identificationField`,
    );
  }

  deletePayment(paymentId: string): Promise<{ deleted: boolean; id: string }> {
    return this.request('DELETE', `/payments/${encodeURIComponent(paymentId)}`);
  }

  refundPayment(paymentId: string, value?: number): Promise<AsaasPayment> {
    return this.request<AsaasPayment>(
      'POST',
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      value ? { value } : {},
    );
  }
}
