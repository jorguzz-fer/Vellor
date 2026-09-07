import { describe, expect, it } from 'vitest';
import { centsToInput, inputToCents, maskCepInput, maskCpfInput, maskPhoneInput } from './format';

describe('máscaras de entrada', () => {
  it('formata CPF, CEP e telefone progressivamente', () => {
    expect(maskCpfInput('52998224725')).toBe('529.982.247-25');
    expect(maskCpfInput('5299')).toBe('529.9');
    expect(maskCepInput('01310100')).toBe('01310-100');
    expect(maskPhoneInput('11912345678')).toBe('(11) 91234-5678');
    expect(maskPhoneInput('1131234567')).toBe('(11) 3123-4567');
  });

  it('converte moeda de/para centavos', () => {
    expect(centsToInput(1234567)).toBe('12.345,67');
    expect(inputToCents('12.345,67')).toBe(1234567);
    expect(inputToCents('1234.5')).toBe(123450);
    expect(inputToCents('')).toBeNull();
  });
});
