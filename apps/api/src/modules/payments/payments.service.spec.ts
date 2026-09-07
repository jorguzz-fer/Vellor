import { describe, expect, it } from 'vitest';
import { mapAsaasStatus, PaymentsService } from './payments.service';

describe('mapeamento de status do Asaas', () => {
  it('converte os status conhecidos', () => {
    expect(mapAsaasStatus('PENDING')).toBe('pending');
    expect(mapAsaasStatus('CONFIRMED')).toBe('confirmed');
    expect(mapAsaasStatus('RECEIVED')).toBe('received');
    expect(mapAsaasStatus('OVERDUE')).toBe('overdue');
    expect(mapAsaasStatus('REFUNDED')).toBe('refunded');
    expect(mapAsaasStatus('DELETED')).toBe('cancelled');
    expect(mapAsaasStatus('QUALQUER_COISA')).toBe('pending');
  });
});

describe('cobrança simulada', () => {
  const config = { paymentsMock: true, env: { APP_URL: 'http://localhost:3000' } } as never;
  const service = new PaymentsService({} as never, config, {
    setContext: () => undefined,
  } as never);

  it('gera Pix com QR code e payload marcado como simulado', async () => {
    const result = await service.createCharge({
      orderId: '00000000-0000-0000-0000-000000000001',
      orderNumber: 'VL-1001',
      method: 'pix',
      totalCents: 123456,
      installments: 1,
      installmentCents: 123456,
      customer: { name: 'A', email: 'a@b.com', cpf: '52998224725', phone: '11912345678' },
      address: { cep: '01310100', street: 'x', number: '1', district: 'y', city: 'z', state: 'SP' },
      boletoDueDays: 3,
      pixExpirationMinutes: 60,
    });
    expect(result.providerName).toBe('mock');
    expect(result.pix?.payload).toContain('SIMULADO-VL-1001');
    expect(result.pix?.qrCodeBase64?.length).toBeGreaterThan(100);
    expect(result.boleto).toBeNull();
  });

  it('gera boleto com linha digitável e cartão com link de checkout', async () => {
    const base = {
      orderId: '00000000-0000-0000-0000-000000000002',
      orderNumber: 'VL-1002',
      totalCents: 500000,
      installments: 3,
      installmentCents: 166667,
      customer: { name: 'A', email: 'a@b.com', cpf: '52998224725', phone: '11912345678' },
      address: {
        cep: '01310100',
        street: 'x',
        number: '1',
        district: 'y',
        city: 'z',
        state: 'SP' as const,
      },
      boletoDueDays: 3,
      pixExpirationMinutes: 60,
    };
    const boleto = await service.createCharge({ ...base, method: 'boleto' });
    expect(boleto.boleto?.identificationField).toBeTruthy();
    expect(boleto.boleto?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const card = await service.createCharge({ ...base, method: 'credit_card' });
    expect(card.creditCard?.checkoutUrl).toContain('/pedido/');
  });
});
