import { Injectable } from '@nestjs/common';
import {
  type BrazilState,
  BRAZIL_STATES,
  type CepLookup,
  isValidCEP,
  normalizeCEP,
  stateFromCep,
} from '@vellor/shared';
import { PinoLogger } from 'nestjs-pino';
import { NotFoundError, UnprocessableError } from '../../common/errors';

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 5000;
const TIMEOUT_MS = 4000;

/** Consulta de endereço por CEP (ViaCEP) com cache e degradação graciosa. */
@Injectable()
export class CepService {
  private readonly cache = new Map<string, { value: CepLookup; expiresAt: number }>();

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(CepService.name);
  }

  async lookup(raw: string): Promise<CepLookup> {
    const cep = normalizeCEP(raw);
    if (!isValidCEP(cep))
      throw new UnprocessableError('CEP inválido', 'invalid_cep', {
        cep: ['Informe um CEP com 8 dígitos'],
      });

    const cached = this.cache.get(cep);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const state = stateFromCep(cep);
    let result: CepLookup;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`ViaCEP respondeu ${res.status}`);
      const data = (await res.json()) as ViaCepResponse;
      if (data.erro) throw new NotFoundError('CEP não encontrado', 'cep_not_found');
      const uf = (data.uf ?? state ?? '') as BrazilState;
      if (!BRAZIL_STATES.includes(uf))
        throw new NotFoundError('CEP não encontrado', 'cep_not_found');
      result = {
        cep,
        street: data.logradouro ?? '',
        district: data.bairro ?? '',
        city: data.localidade ?? '',
        state: uf,
        partial: false,
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      this.logger.warn({ err: error, cep }, 'ViaCEP indisponível; devolvendo resposta parcial');
      if (!state) throw new NotFoundError('CEP não encontrado', 'cep_not_found');
      result = { cep, street: '', district: '', city: '', state, partial: true };
    }

    if (!result.partial) {
      if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(cep, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return result;
  }
}
