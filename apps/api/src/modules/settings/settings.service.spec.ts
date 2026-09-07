import { DEFAULT_STORE_SETTINGS, StoreSettingsSchema } from '@vellor/shared';
import { describe, expect, it } from 'vitest';
import { deepMerge } from './settings.service';

describe('deepMerge das configurações', () => {
  it('preenche chaves novas com o padrão e substitui arrays inteiros', () => {
    const stored = {
      store: { name: 'Minha Loja' },
      shipping: {
        fallbackTable: [
          { name: 'Tudo', states: ['SP'], pacCents: 1, sedexCents: 2, pacDays: 3, sedexDays: 4 },
        ],
      },
    };
    const merged = deepMerge(DEFAULT_STORE_SETTINGS, stored);
    expect(merged.store.name).toBe('Minha Loja');
    expect(merged.store.email).toBe(DEFAULT_STORE_SETTINGS.store.email);
    expect(merged.shipping.fallbackTable).toHaveLength(1);
    expect(merged.payments.maxInstallments).toBe(12);
    expect(StoreSettingsSchema.safeParse(merged).success).toBe(true);
  });
});
