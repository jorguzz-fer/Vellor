import { Injectable } from '@nestjs/common';
import type { ShippingService as ShippingServiceCode } from '@vellor/shared';
import { PinoLogger } from 'nestjs-pino';
import { AppConfig } from '../../config/app-config';

/**
 * Cliente da API oficial dos Correios (https://cws.correios.com.br), que exige contrato e
 * cartão de postagem. Códigos de serviço com contrato: PAC 03298, SEDEX 03220.
 */
export const CORREIOS_SERVICE_CODES: Record<ShippingServiceCode, string> = {
  PAC: '03298',
  SEDEX: '03220',
};

interface TokenResponse {
  token: string;
  expiraEm: string;
  cartaoPostagem?: { numero: string; contrato: string; dr: number };
}

interface PriceResponse {
  coProduto: string;
  pcFinal?: string;
  pcBase?: string;
  txErro?: string;
}

interface DeadlineResponse {
  coProduto: string;
  prazoEntrega?: number;
  txErro?: string;
}

export interface CorreiosQuoteParams {
  service: ShippingServiceCode;
  originCep: string;
  destinationCep: string;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface CorreiosQuoteResult {
  freightCents: number;
  deadlineDays: number;
}

const REQUEST_TIMEOUT_MS = 6000;

@Injectable()
export class CorreiosClient {
  private token: { value: string; expiresAt: number; contract: string; dr: number } | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CorreiosClient.name);
  }

  get enabled(): boolean {
    return this.config.correiosEnabled;
  }

  private async fetchJson<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.config.env.CORREIOS_API_URL}${path}`, {
        ...init,
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok)
        throw new Error(`Correios ${path} respondeu ${res.status}: ${text.slice(0, 300)}`);
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async authenticate(): Promise<{ token: string; contract: string; dr: number }> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return { token: this.token.value, contract: this.token.contract, dr: this.token.dr };
    }
    const { CORREIOS_USER, CORREIOS_ACCESS_CODE, CORREIOS_POSTAGE_CARD } = this.config.env;
    const basic = Buffer.from(`${CORREIOS_USER}:${CORREIOS_ACCESS_CODE}`).toString('base64');
    const data = await this.fetchJson<TokenResponse>('/token/v1/autentica/cartaopostagem', {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: CORREIOS_POSTAGE_CARD }),
    });
    this.token = {
      value: data.token,
      expiresAt: new Date(data.expiraEm).getTime() || Date.now() + 30 * 60_000,
      contract: data.cartaoPostagem?.contrato ?? '',
      dr: data.cartaoPostagem?.dr ?? 0,
    };
    return { token: this.token.value, contract: this.token.contract, dr: this.token.dr };
  }

  async quote(params: CorreiosQuoteParams): Promise<CorreiosQuoteResult> {
    const auth = await this.authenticate();
    const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };
    const coProduto = CORREIOS_SERVICE_CODES[params.service];
    const cepOrigem = params.originCep.replace(/\D/g, '');
    const cepDestino = params.destinationCep.replace(/\D/g, '');

    const [prices, deadlines] = await Promise.all([
      this.fetchJson<PriceResponse[]>('/preco/v1/nacional', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          idLote: '1',
          parametrosProduto: [
            {
              coProduto,
              nuRequisicao: '1',
              nuContrato: auth.contract,
              nuDR: auth.dr,
              cepOrigem,
              cepDestino,
              psObjeto: String(Math.max(1, Math.round(params.weightGrams))),
              tpObjeto: '2',
              comprimento: String(Math.round(params.lengthCm)),
              largura: String(Math.round(params.widthCm)),
              altura: String(Math.round(params.heightCm)),
            },
          ],
        }),
      }),
      this.fetchJson<DeadlineResponse[]>('/prazo/v1/nacional', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          idLote: '1',
          parametrosPrazo: [{ coProduto, nuRequisicao: '1', cepOrigem, cepDestino }],
        }),
      }),
    ]);

    const price = prices[0];
    const deadline = deadlines[0];
    if (!price || price.txErro)
      throw new Error(`Correios preço: ${price?.txErro ?? 'resposta vazia'}`);
    if (!deadline || deadline.txErro)
      throw new Error(`Correios prazo: ${deadline?.txErro ?? 'resposta vazia'}`);
    const raw = (price.pcFinal ?? price.pcBase ?? '0').replace(/\./g, '').replace(',', '.');
    const freightCents = Math.round(Number(raw) * 100);
    if (!Number.isFinite(freightCents) || freightCents <= 0)
      throw new Error(`Correios preço inválido: ${price.pcFinal}`);
    return { freightCents, deadlineDays: Math.max(1, Number(deadline.prazoEntrega ?? 0)) };
  }
}
