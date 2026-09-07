import { Injectable } from '@nestjs/common';
import {
  type ShippingOption,
  type ShippingQuote,
  type ShippingRegionRate,
  type ShippingService as ShippingServiceCode,
  SHIPPING_SERVICE_LABELS,
  stateFromCep,
} from '@vellor/shared';
import { PinoLogger } from 'nestjs-pino';
import { UnprocessableError } from '../../common/errors';
import { SettingsService } from '../settings/settings.service';
import { CorreiosClient } from './correios.client';

export interface PackageSpec {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface ShippingQuoteParams {
  destinationCep: string;
  declaredValueCents: number;
  subtotalCents: number;
  pkg: PackageSpec;
}

/** Dimensões mínimas/máximas aceitas pelos Correios para pacotes. */
export function normalizePackage(pkg: PackageSpec): PackageSpec {
  return {
    weightGrams: Math.min(30_000, Math.max(50, Math.round(pkg.weightGrams))),
    lengthCm: Math.min(100, Math.max(16, pkg.lengthCm)),
    widthCm: Math.min(100, Math.max(11, pkg.widthCm)),
    heightCm: Math.min(100, Math.max(2, pkg.heightCm)),
  };
}

/** Combina itens em um único pacote: soma pesos e alturas, mantém maior comprimento/largura. */
export function combinePackages(items: Array<PackageSpec & { quantity: number }>): PackageSpec {
  const combined = items.reduce<PackageSpec>(
    (acc, item) => ({
      weightGrams: acc.weightGrams + item.weightGrams * item.quantity,
      lengthCm: Math.max(acc.lengthCm, item.lengthCm),
      widthCm: Math.max(acc.widthCm, item.widthCm),
      heightCm: acc.heightCm + item.heightCm * item.quantity,
    }),
    { weightGrams: 0, lengthCm: 0, widthCm: 0, heightCm: 0 },
  );
  return normalizePackage(combined);
}

@Injectable()
export class ShippingService {
  constructor(
    private readonly settings: SettingsService,
    private readonly correios: CorreiosClient,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ShippingService.name);
  }

  async quote(params: ShippingQuoteParams): Promise<ShippingQuote> {
    const settings = await this.settings.get();
    const shipping = settings.shipping;
    const declared = Math.min(params.declaredValueCents, shipping.maxDeclaredValueCents);
    const insuranceCents = Math.max(
      shipping.insuranceMinCents,
      Math.ceil((declared * shipping.insurancePercent) / 100),
    );
    const freeShipping =
      shipping.freeShippingThresholdCents > 0 &&
      params.subtotalCents >= shipping.freeShippingThresholdCents;
    const pkg = normalizePackage(params.pkg);
    const state = stateFromCep(params.destinationCep);
    if (!state)
      throw new UnprocessableError('CEP de destino inválido', 'invalid_cep', {
        cep: ['CEP inválido'],
      });

    const options: ShippingOption[] = [];
    for (const service of shipping.services) {
      let freightCents: number;
      let deadlineDays: number;
      let source: ShippingOption['source'] = 'table';
      if (this.correios.enabled) {
        try {
          const result = await this.correios.quote({
            service,
            originCep: shipping.originCep,
            destinationCep: params.destinationCep,
            ...pkg,
          });
          freightCents = result.freightCents;
          deadlineDays = result.deadlineDays;
          source = 'correios';
        } catch (error) {
          this.logger.warn(
            { err: error, service },
            'Correios indisponível; usando tabela de contingência',
          );
          ({ freightCents, deadlineDays } = this.fromTable(shipping.fallbackTable, state, service));
        }
      } else {
        ({ freightCents, deadlineDays } = this.fromTable(shipping.fallbackTable, state, service));
      }
      const totalDeadline = deadlineDays + shipping.handlingDays;
      const finalFreight = freeShipping ? 0 : freightCents;
      options.push({
        service,
        name: SHIPPING_SERVICE_LABELS[service],
        freightCents: finalFreight,
        insuranceCents,
        totalCents: finalFreight + insuranceCents,
        deadlineDays: totalDeadline,
        deadlineLabel: `até ${totalDeadline} dia${totalDeadline === 1 ? '' : 's'} út${totalDeadline === 1 ? 'il' : 'eis'}`,
        source,
      });
    }
    options.sort((a, b) => a.totalCents - b.totalCents);
    return { cep: params.destinationCep, options, declaredValueCents: declared, freeShipping };
  }

  private fromTable(
    table: ShippingRegionRate[],
    state: string,
    service: ShippingServiceCode,
  ): { freightCents: number; deadlineDays: number } {
    const region =
      table.find((r) => r.states.includes(state as ShippingRegionRate['states'][number])) ??
      [...table].sort((a, b) => b.sedexCents - a.sedexCents)[0];
    if (!region)
      throw new UnprocessableError('Tabela de frete não configurada', 'shipping_table_missing');
    return service === 'SEDEX'
      ? { freightCents: region.sedexCents, deadlineDays: region.sedexDays }
      : { freightCents: region.pacCents, deadlineDays: region.pacDays };
  }
}
