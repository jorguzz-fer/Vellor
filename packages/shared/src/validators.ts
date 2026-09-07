/** Validações e formatações de dados brasileiros (CPF, CEP, telefone). */

export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

export function normalizeCPF(value: string): string {
  return onlyDigits(value);
}

/** Valida CPF pelos dígitos verificadores; rejeita sequências repetidas (111.111.111-11). */
export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split('').map(Number);
  const check = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += digits[i]! * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === digits[9] && check(10) === digits[10];
}

export function formatCPF(value: string): string {
  const cpf = onlyDigits(value).slice(0, 11);
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_m, a, b, c, d) =>
    d ? `${a}.${b}.${c}-${d}` : `${a}.${b}.${c}`,
  );
}

/** Mascara o CPF para exibição: 123.456.789-09 -> ***.456.789-** */
export function maskCPF(value: string): string {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return '***';
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

export function normalizeCEP(value: string): string {
  return onlyDigits(value);
}

export function isValidCEP(value: string): boolean {
  return /^\d{8}$/.test(onlyDigits(value));
}

export function formatCEP(value: string): string {
  const cep = onlyDigits(value).slice(0, 8);
  return cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep;
}

export function normalizePhone(value: string): string {
  let digits = onlyDigits(value);
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  return digits;
}

/** Telefone brasileiro com DDD: 10 dígitos (fixo) ou 11 (celular). */
export function isValidPhone(value: string): boolean {
  const digits = normalizePhone(value);
  return digits.length === 10 || digits.length === 11;
}

export function formatPhoneBR(value: string): string {
  const digits = normalizePhone(value);
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '***';
  const visible = user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]): number => {
    const sum = base.split('').reduce((acc, d, i) => acc + Number(d) * weights[i]!, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 12) + d1, w2);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function formatCNPJ(value: string): string {
  const c = onlyDigits(value).slice(0, 14);
  if (c.length !== 14) return value;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}
