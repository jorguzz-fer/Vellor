import type { CategoryKind } from './enums.js';

/**
 * Atributos específicos por tipo de categoria.
 * A ficha técnica de um relógio é diferente da de um perfume; o admin usa estas
 * definições para montar o formulário e a loja para exibir a ficha na página do produto.
 */
export type AttributeFieldType = 'text' | 'number' | 'select' | 'textarea';

export interface AttributeField {
  key: string;
  label: string;
  type: AttributeFieldType;
  group: string;
  options?: readonly string[];
  unit?: string;
  placeholder?: string;
  /** Aparece no resumo do card/lista (no máximo 3 por categoria são usados). */
  summary?: boolean;
}

export const WATCH_ATTRIBUTES: readonly AttributeField[] = [
  {
    key: 'reference',
    label: 'Referência',
    type: 'text',
    group: 'Identificação',
    placeholder: 'Ex.: 126610LN',
  },
  {
    key: 'movement',
    label: 'Movimento',
    type: 'select',
    group: 'Mecanismo',
    options: [
      'Automático',
      'Automático com cronógrafo',
      'Corda manual',
      'Quartzo',
      'Tourbillon',
      'Híbrido (Spring Drive / Kinetic)',
    ],
    summary: true,
  },
  { key: 'calibre', label: 'Calibre', type: 'text', group: 'Mecanismo', placeholder: 'Ex.: 3235' },
  {
    key: 'powerReserve',
    label: 'Reserva de marcha',
    type: 'text',
    group: 'Mecanismo',
    placeholder: 'Ex.: 70 horas',
  },
  {
    key: 'functions',
    label: 'Funções e complicações',
    type: 'textarea',
    group: 'Mecanismo',
    placeholder: 'Ex.: horas, minutos, segundos, data, cronógrafo, GMT',
  },
  {
    key: 'caseMaterial',
    label: 'Material da caixa',
    type: 'text',
    group: 'Caixa',
    placeholder: 'Ex.: Aço inoxidável 904L',
    summary: true,
  },
  {
    key: 'caseDiameter',
    label: 'Diâmetro da caixa',
    type: 'number',
    group: 'Caixa',
    unit: 'mm',
    summary: true,
  },
  { key: 'caseThickness', label: 'Espessura', type: 'number', group: 'Caixa', unit: 'mm' },
  { key: 'crystal', label: 'Vidro', type: 'text', group: 'Caixa', placeholder: 'Ex.: Safira' },
  {
    key: 'waterResistance',
    label: 'Resistência à água',
    type: 'text',
    group: 'Caixa',
    placeholder: 'Ex.: 100 m',
  },
  { key: 'dialColor', label: 'Cor do mostrador', type: 'text', group: 'Mostrador' },
  {
    key: 'strap',
    label: 'Pulseira',
    type: 'text',
    group: 'Pulseira',
    placeholder: 'Ex.: Couro de jacaré',
  },
  { key: 'clasp', label: 'Fecho', type: 'text', group: 'Pulseira' },
  {
    key: 'gender',
    label: 'Público',
    type: 'select',
    group: 'Geral',
    options: ['Masculino', 'Feminino', 'Unissex'],
  },
  {
    key: 'condition',
    label: 'Condição',
    type: 'select',
    group: 'Autenticidade',
    options: ['Novo', 'Seminovo', 'Vintage'],
  },
  {
    key: 'boxAndPapers',
    label: 'Caixa e documentos',
    type: 'select',
    group: 'Autenticidade',
    options: [
      'Completo (caixa e certificado)',
      'Somente caixa',
      'Somente certificado',
      'Sem caixa e documentos',
    ],
  },
  { key: 'productionYear', label: 'Ano', type: 'text', group: 'Autenticidade' },
  {
    key: 'warranty',
    label: 'Garantia',
    type: 'text',
    group: 'Autenticidade',
    placeholder: 'Ex.: 2 anos Vellor',
  },
];

export const PERFUME_ATTRIBUTES: readonly AttributeField[] = [
  {
    key: 'concentration',
    label: 'Concentração',
    type: 'select',
    group: 'Fragrância',
    options: ['Extrait de Parfum', 'Parfum', 'Eau de Parfum', 'Eau de Toilette', 'Eau de Cologne'],
    summary: true,
  },
  {
    key: 'olfactoryFamily',
    label: 'Família olfativa',
    type: 'select',
    group: 'Fragrância',
    options: [
      'Amadeirado',
      'Oriental / Âmbar',
      'Floral',
      'Cítrico',
      'Chipre',
      'Fougère',
      'Couro',
      'Gourmand',
      'Aquático',
      'Verde',
      'Aromático',
    ],
    summary: true,
  },
  { key: 'topNotes', label: 'Notas de saída', type: 'text', group: 'Pirâmide olfativa' },
  { key: 'heartNotes', label: 'Notas de coração', type: 'text', group: 'Pirâmide olfativa' },
  { key: 'baseNotes', label: 'Notas de fundo', type: 'text', group: 'Pirâmide olfativa' },
  {
    key: 'longevity',
    label: 'Fixação',
    type: 'select',
    group: 'Performance',
    options: ['Moderada', 'Longa', 'Muito longa'],
  },
  {
    key: 'sillage',
    label: 'Projeção',
    type: 'select',
    group: 'Performance',
    options: ['Discreta', 'Moderada', 'Intensa'],
  },
  { key: 'perfumer', label: 'Perfumista', type: 'text', group: 'Origem' },
  { key: 'origin', label: 'País de origem', type: 'text', group: 'Origem' },
  { key: 'launchYear', label: 'Ano de lançamento', type: 'text', group: 'Origem' },
  {
    key: 'gender',
    label: 'Público',
    type: 'select',
    group: 'Geral',
    options: ['Masculino', 'Feminino', 'Unissex'],
    summary: true,
  },
  {
    key: 'sealed',
    label: 'Estado',
    type: 'select',
    group: 'Autenticidade',
    options: ['Lacrado', 'Sem lacre (novo)', 'Testado'],
  },
];

export function attributesForKind(kind: CategoryKind): readonly AttributeField[] {
  switch (kind) {
    case 'watch':
      return WATCH_ATTRIBUTES;
    case 'perfume':
      return PERFUME_ATTRIBUTES;
    default:
      return [];
  }
}

export type ProductAttributes = Record<string, string | number>;

/** Formata o valor de um atributo com unidade para exibição. */
export function formatAttributeValue(field: AttributeField, value: string | number): string {
  if (value === '' || value === null || value === undefined) return '';
  return field.unit ? `${value} ${field.unit}` : String(value);
}
