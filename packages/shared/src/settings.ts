import { z } from 'zod';
import { BRAZIL_STATES, SHIPPING_SERVICES } from './enums.js';

/**
 * Configurações da loja editáveis pelo Admin. Ficam na tabela `settings` como JSON
 * e são validadas por este schema tanto ao salvar quanto ao ler.
 */

export const ShippingRegionRateSchema = z.object({
  name: z.string().min(1),
  states: z.array(z.enum(BRAZIL_STATES)).min(1),
  pacCents: z.number().int().min(0),
  sedexCents: z.number().int().min(0),
  pacDays: z.number().int().min(1),
  sedexDays: z.number().int().min(1),
});
export type ShippingRegionRate = z.infer<typeof ShippingRegionRateSchema>;

export const StoreSettingsSchema = z.object({
  store: z.object({
    name: z.string().min(1).max(80),
    tagline: z.string().max(160),
    legalName: z.string().max(160),
    cnpj: z.string().max(20),
    email: z.string().max(160),
    phone: z.string().max(30),
    whatsapp: z.string().max(30),
    instagram: z.string().max(80),
    address: z.object({
      street: z.string().max(160),
      number: z.string().max(20),
      complement: z.string().max(80),
      district: z.string().max(80),
      city: z.string().max(80),
      state: z.string().max(2),
      cep: z.string().max(9),
    }),
    businessHours: z.string().max(160),
  }),
  announcement: z.object({
    enabled: z.boolean(),
    text: z.string().max(200),
  }),
  shipping: z.object({
    originCep: z.string().max(9),
    services: z.array(z.enum(SHIPPING_SERVICES)).min(1),
    /** Percentual do valor declarado cobrado como seguro (Correios: valor declarado). */
    insurancePercent: z.number().min(0).max(10),
    /** Seguro mínimo em centavos. */
    insuranceMinCents: z.number().int().min(0),
    /** Valor máximo declarável por pacote (limite dos Correios). Acima disso, dividir a remessa ou usar transportadora. */
    maxDeclaredValueCents: z.number().int().min(0),
    /** Dias úteis para postar após a confirmação do pagamento. */
    handlingDays: z.number().int().min(0).max(30),
    /** Subtotal a partir do qual o frete é grátis (0 desativa). O seguro continua incluído. */
    freeShippingThresholdCents: z.number().int().min(0),
    /** Tabela de contingência usada quando a API dos Correios está indisponível ou sem contrato. */
    fallbackTable: z.array(ShippingRegionRateSchema).min(1),
  }),
  payments: z.object({
    maxInstallments: z.number().int().min(1).max(12),
    minInstallmentCents: z.number().int().min(100),
    interestFreeInstallments: z.number().int().min(1).max(12),
    monthlyInterestRate: z.number().min(0).max(0.2),
    pixDiscountPercent: z.number().min(0).max(30),
    boletoDueDays: z.number().int().min(1).max(15),
    pixExpirationMinutes: z.number().int().min(10).max(1440),
  }),
  legal: z.object({
    privacyPolicy: z.string().max(50_000),
    termsOfService: z.string().max(50_000),
    exchangePolicy: z.string().max(50_000),
  }),
});
export type StoreSettings = z.infer<typeof StoreSettingsSchema>;

/** Versão pública das configurações (sem dados que só o admin deve ver). */
export const PublicSettingsSchema = z.object({
  store: StoreSettingsSchema.shape.store,
  announcement: StoreSettingsSchema.shape.announcement,
  shipping: z.object({
    freeShippingThresholdCents: z.number().int(),
    handlingDays: z.number().int(),
    services: z.array(z.enum(SHIPPING_SERVICES)),
  }),
  payments: z.object({
    maxInstallments: z.number().int(),
    minInstallmentCents: z.number().int(),
    interestFreeInstallments: z.number().int(),
    monthlyInterestRate: z.number(),
    pixDiscountPercent: z.number(),
    boletoDueDays: z.number().int(),
  }),
  legal: StoreSettingsSchema.shape.legal,
});
export type PublicSettings = z.infer<typeof PublicSettingsSchema>;

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  store: {
    name: 'Vellor',
    tagline: 'Relógios de luxo e perfumes de nicho',
    legalName: '‹decidir› Razão social da empresa',
    cnpj: '00.000.000/0000-00',
    email: 'atendimento@vellor.com.br',
    phone: '(11) 0000-0000',
    whatsapp: '5511900000000',
    instagram: 'vellor',
    address: {
      street: '‹decidir› Rua',
      number: '000',
      complement: '',
      district: 'Bairro',
      city: 'São Paulo',
      state: 'SP',
      cep: '01000-000',
    },
    businessHours: 'Segunda a sexta, das 9h às 18h',
  },
  announcement: {
    enabled: true,
    text: 'Envio segurado pelos Correios para todo o Brasil · Pix, boleto ou cartão em até 12x',
  },
  shipping: {
    originCep: '01000-000',
    services: ['PAC', 'SEDEX'],
    insurancePercent: 1,
    insuranceMinCents: 500,
    maxDeclaredValueCents: 1_000_000,
    handlingDays: 2,
    freeShippingThresholdCents: 0,
    fallbackTable: [
      {
        name: 'Sudeste',
        states: ['SP', 'RJ', 'MG', 'ES'],
        pacCents: 3500,
        sedexCents: 6500,
        pacDays: 6,
        sedexDays: 3,
      },
      {
        name: 'Sul',
        states: ['PR', 'SC', 'RS'],
        pacCents: 4200,
        sedexCents: 7800,
        pacDays: 8,
        sedexDays: 4,
      },
      {
        name: 'Centro-Oeste',
        states: ['DF', 'GO', 'MT', 'MS'],
        pacCents: 4800,
        sedexCents: 8900,
        pacDays: 9,
        sedexDays: 4,
      },
      {
        name: 'Nordeste',
        states: ['BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA'],
        pacCents: 5900,
        sedexCents: 10900,
        pacDays: 12,
        sedexDays: 5,
      },
      {
        name: 'Norte',
        states: ['AM', 'PA', 'AC', 'RO', 'RR', 'AP', 'TO'],
        pacCents: 6900,
        sedexCents: 12900,
        pacDays: 15,
        sedexDays: 6,
      },
    ],
  },
  payments: {
    maxInstallments: 12,
    minInstallmentCents: 10_000,
    interestFreeInstallments: 12,
    monthlyInterestRate: 0,
    pixDiscountPercent: 0,
    boletoDueDays: 3,
    pixExpirationMinutes: 60,
  },
  legal: {
    privacyPolicy:
      '‹decidir› Política de privacidade (LGPD): quais dados coletamos, finalidade, base legal, prazo de retenção, direitos do titular e canal do encarregado (DPO).',
    termsOfService:
      '‹decidir› Termos de compra: prazos, condições de pagamento, garantia, autenticidade, foro.',
    exchangePolicy:
      '‹decidir› Política de trocas e devoluções conforme o Código de Defesa do Consumidor (art. 49: 7 dias para arrependimento em compras online).',
  },
};

export function toPublicSettings(settings: StoreSettings): PublicSettings {
  return {
    store: settings.store,
    announcement: settings.announcement,
    shipping: {
      freeShippingThresholdCents: settings.shipping.freeShippingThresholdCents,
      handlingDays: settings.shipping.handlingDays,
      services: settings.shipping.services,
    },
    payments: {
      maxInstallments: settings.payments.maxInstallments,
      minInstallmentCents: settings.payments.minInstallmentCents,
      interestFreeInstallments: settings.payments.interestFreeInstallments,
      monthlyInterestRate: settings.payments.monthlyInterestRate,
      pixDiscountPercent: settings.payments.pixDiscountPercent,
      boletoDueDays: settings.payments.boletoDueDays,
    },
    legal: settings.legal,
  };
}
