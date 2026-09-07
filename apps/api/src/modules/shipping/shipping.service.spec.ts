import { DEFAULT_STORE_SETTINGS } from '@vellor/shared';
import { describe, expect, it } from 'vitest';
import { combinePackages, normalizePackage, ShippingService } from './shipping.service';

const settings = { get: async () => DEFAULT_STORE_SETTINGS } as never;
const logger = { setContext: () => undefined, warn: () => undefined } as never;

describe('pacotes', () => {
  it('respeita as dimensões mínimas dos Correios', () => {
    expect(normalizePackage({ weightGrams: 10, lengthCm: 5, widthCm: 5, heightCm: 1 })).toEqual({
      weightGrams: 50,
      lengthCm: 16,
      widthCm: 11,
      heightCm: 2,
    });
  });

  it('combina itens somando peso e altura', () => {
    const pkg = combinePackages([
      { quantity: 2, weightGrams: 500, lengthCm: 20, widthCm: 15, heightCm: 10 },
      { quantity: 1, weightGrams: 900, lengthCm: 22, widthCm: 12, heightCm: 8 },
    ]);
    expect(pkg).toEqual({ weightGrams: 1900, lengthCm: 22, widthCm: 15, heightCm: 28 });
  });
});

describe('cotação pela tabela de contingência', () => {
  const service = new ShippingService(settings, { enabled: false } as never, logger);

  it('usa a região do CEP, soma o seguro e o prazo de postagem', async () => {
    const quote = await service.quote({
      destinationCep: '90010000',
      declaredValueCents: 1_000_000,
      subtotalCents: 1_000_000,
      pkg: { weightGrams: 800, lengthCm: 20, widthCm: 15, heightCm: 10 },
    });
    const sul = DEFAULT_STORE_SETTINGS.shipping.fallbackTable.find((r) => r.name === 'Sul')!;
    const pac = quote.options.find((o) => o.service === 'PAC')!;
    expect(pac.freightCents).toBe(sul.pacCents);
    expect(pac.insuranceCents).toBe(Math.ceil(1_000_000 * 0.01));
    expect(pac.totalCents).toBe(sul.pacCents + pac.insuranceCents);
    expect(pac.deadlineDays).toBe(sul.pacDays + DEFAULT_STORE_SETTINGS.shipping.handlingDays);
    expect(pac.source).toBe('table');
    expect(quote.options[0]!.totalCents).toBeLessThanOrEqual(quote.options[1]!.totalCents);
  });

  it('limita o valor declarado ao teto configurado', async () => {
    const quote = await service.quote({
      destinationCep: '01310100',
      declaredValueCents: 50_000_000,
      subtotalCents: 50_000_000,
      pkg: { weightGrams: 800, lengthCm: 20, widthCm: 15, heightCm: 10 },
    });
    expect(quote.declaredValueCents).toBe(DEFAULT_STORE_SETTINGS.shipping.maxDeclaredValueCents);
  });

  it('rejeita CEP inválido', async () => {
    await expect(
      service.quote({
        destinationCep: '123',
        declaredValueCents: 1000,
        subtotalCents: 1000,
        pkg: { weightGrams: 100, lengthCm: 16, widthCm: 11, heightCm: 2 },
      }),
    ).rejects.toMatchObject({ code: 'invalid_cep' });
  });
});
