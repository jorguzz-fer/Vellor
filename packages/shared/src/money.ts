/**
 * Dinheiro é sempre representado em centavos inteiros (BRL).
 * Nunca use ponto flutuante para somar valores de pedido.
 */

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

/** Formata centavos como moeda brasileira: 123456 -> "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  if (!Number.isFinite(cents)) return brlFormatter.format(0);
  return brlFormatter.format(Math.round(cents) / 100);
}

/** Converte um número decimal (ex.: 1234.56) em centavos inteiros com arredondamento seguro. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Converte centavos em número decimal (para APIs externas que usam reais, como o Asaas). */
export function centsToDecimal(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Interpreta entrada humana em reais ("1.234,56", "1234.56", "R$ 1.234,56") e devolve centavos.
 * Retorna null quando não é possível interpretar.
 */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return null;
  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > -1 && lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastComma > -1 && lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, '');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return toCents(value);
}

/** Aplica um percentual (0-100) sobre centavos, arredondando para baixo em favor do cliente. */
export function percentOf(cents: number, percent: number): number {
  return Math.floor((cents * percent) / 100);
}

export interface InstallmentOption {
  /** Número de parcelas (1 = à vista). */
  count: number;
  /** Valor de cada parcela em centavos. */
  installmentCents: number;
  /** Total pago ao final em centavos. */
  totalCents: number;
  /** Indica se a opção tem juros. */
  hasInterest: boolean;
  /** Texto pronto para exibição, ex.: "3x de R$ 1.000,00 sem juros". */
  label: string;
}

export interface InstallmentRules {
  /** Máximo de parcelas oferecidas (1-12). */
  maxInstallments: number;
  /** Valor mínimo de cada parcela, em centavos. */
  minInstallmentCents: number;
  /** Até quantas parcelas não há juros para o cliente. */
  interestFreeInstallments: number;
  /** Juros mensais repassados ao cliente acima do limite sem juros (ex.: 0.0199 = 1,99% a.m.). */
  monthlyInterestRate: number;
}

/**
 * Calcula as opções de parcelamento para um total, seguindo as regras da loja.
 * Para parcelas com juros usa a Tabela Price: PMT = PV * i / (1 - (1 + i)^-n).
 */
export function calculateInstallments(
  totalCents: number,
  rules: InstallmentRules,
): InstallmentOption[] {
  const options: InstallmentOption[] = [];
  const max = Math.min(Math.max(1, Math.floor(rules.maxInstallments)), 12);
  for (let n = 1; n <= max; n++) {
    const hasInterest = n > rules.interestFreeInstallments && rules.monthlyInterestRate > 0;
    let installmentCents: number;
    if (hasInterest) {
      const i = rules.monthlyInterestRate;
      const pmt = (totalCents * i) / (1 - Math.pow(1 + i, -n));
      installmentCents = Math.ceil(pmt);
    } else {
      installmentCents = Math.ceil(totalCents / n);
    }
    if (n > 1 && installmentCents < rules.minInstallmentCents) break;
    const total = hasInterest ? installmentCents * n : totalCents;
    options.push({
      count: n,
      installmentCents,
      totalCents: total,
      hasInterest,
      label:
        n === 1
          ? `À vista ${formatBRL(totalCents)}`
          : `${n}x de ${formatBRL(installmentCents)} ${hasInterest ? 'com juros' : 'sem juros'}`,
    });
  }
  return options;
}
