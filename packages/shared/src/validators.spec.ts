import { describe, expect, it } from 'vitest';
import {
  formatCEP,
  formatCPF,
  formatPhoneBR,
  isValidCEP,
  isValidCNPJ,
  isValidCPF,
  isValidPhone,
  maskCPF,
  normalizePhone,
} from './validators.js';

describe('validators', () => {
  it('valida CPF com dígitos verificadores', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
    expect(isValidCPF('52998224725')).toBe(true);
    expect(isValidCPF('111.111.111-11')).toBe(false);
    expect(isValidCPF('529.982.247-26')).toBe(false);
    expect(isValidCPF('123')).toBe(false);
  });

  it('formata e mascara CPF', () => {
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
    expect(maskCPF('52998224725')).toBe('***.982.247-**');
  });

  it('valida e formata CEP', () => {
    expect(isValidCEP('01310-100')).toBe(true);
    expect(isValidCEP('0131010')).toBe(false);
    expect(formatCEP('01310100')).toBe('01310-100');
  });

  it('normaliza e valida telefone', () => {
    expect(normalizePhone('+55 (11) 91234-5678')).toBe('11912345678');
    expect(isValidPhone('(11) 91234-5678')).toBe(true);
    expect(isValidPhone('(11) 3123-4567')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
    expect(formatPhoneBR('11912345678')).toBe('(11) 91234-5678');
  });

  it('valida CNPJ', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    expect(isValidCNPJ('11.222.333/0001-82')).toBe(false);
  });
});
