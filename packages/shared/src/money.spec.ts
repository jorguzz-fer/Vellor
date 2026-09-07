import { describe, expect, it } from 'vitest';
import { calculateInstallments, formatBRL, parseBRLToCents, percentOf, toCents } from './money.js';

/** Intl usa espaço não separável (U+00A0) entre o símbolo e o valor. */
const normalize = (value: string) => value.replace(/\u00a0/g, ' ');

describe('money', () => {
  it('formata centavos em BRL', () => {
    expect(normalize(formatBRL(123456))).toBe('R$ 1.234,56');
    expect(normalize(formatBRL(0))).toBe('R$ 0,00');
  });

  it('converte decimais em centavos sem erro de ponto flutuante', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('interpreta entradas humanas em reais', () => {
    expect(parseBRLToCents('R$ 1.234,56')).toBe(123456);
    expect(parseBRLToCents('1234.56')).toBe(123456);
    expect(parseBRLToCents('1,234.56')).toBe(123456);
    expect(parseBRLToCents('abc')).toBeNull();
  });

  it('calcula percentual arredondando a favor do cliente', () => {
    expect(percentOf(10001, 10)).toBe(1000);
  });

  it('gera parcelas sem juros respeitando o valor mínimo', () => {
    const options = calculateInstallments(30000, {
      maxInstallments: 12,
      minInstallmentCents: 10000,
      interestFreeInstallments: 12,
      monthlyInterestRate: 0,
    });
    expect(options.map((o) => o.count)).toEqual([1, 2, 3]);
    expect(options[2]!.installmentCents).toBe(10000);
    expect(options[2]!.hasInterest).toBe(false);
    expect(options[0]!.label).toContain('À vista');
  });

  it('aplica juros pela Tabela Price acima do limite sem juros', () => {
    const options = calculateInstallments(100000, {
      maxInstallments: 3,
      minInstallmentCents: 100,
      interestFreeInstallments: 1,
      monthlyInterestRate: 0.02,
    });
    expect(options[0]!.totalCents).toBe(100000);
    expect(options[1]!.hasInterest).toBe(true);
    expect(options[1]!.installmentCents).toBe(51505);
    expect(options[1]!.totalCents).toBe(103010);
  });
});
