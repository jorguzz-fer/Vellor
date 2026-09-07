import type { BrazilState } from './enums.js';
import { onlyDigits } from './validators.js';

/** Faixas de CEP por unidade federativa (prefixo de 5 dígitos, inclusivo). */
const CEP_RANGES: Array<[number, number, BrazilState]> = [
  [1000, 19999, 'SP'],
  [20000, 28999, 'RJ'],
  [29000, 29999, 'ES'],
  [30000, 39999, 'MG'],
  [40000, 48999, 'BA'],
  [49000, 49999, 'SE'],
  [50000, 56999, 'PE'],
  [57000, 57999, 'AL'],
  [58000, 58999, 'PB'],
  [59000, 59999, 'RN'],
  [60000, 63999, 'CE'],
  [64000, 64999, 'PI'],
  [65000, 65999, 'MA'],
  [66000, 68899, 'PA'],
  [68900, 68999, 'AP'],
  [69000, 69299, 'AM'],
  [69300, 69399, 'RR'],
  [69400, 69899, 'AM'],
  [69900, 69999, 'AC'],
  [70000, 72799, 'DF'],
  [72800, 72999, 'GO'],
  [73000, 73699, 'DF'],
  [73700, 76799, 'GO'],
  [76800, 76999, 'RO'],
  [77000, 77999, 'TO'],
  [78000, 78899, 'MT'],
  [79000, 79999, 'MS'],
  [80000, 87999, 'PR'],
  [88000, 89999, 'SC'],
  [90000, 99999, 'RS'],
];

/** Infere a UF a partir do CEP (útil para tabela de frete quando o serviço de CEP falha). */
export function stateFromCep(cep: string): BrazilState | null {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  const prefix = Number(digits.slice(0, 5));
  for (const [start, end, state] of CEP_RANGES) {
    if (prefix >= start && prefix <= end) return state;
  }
  return null;
}
