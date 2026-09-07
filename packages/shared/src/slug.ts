/** Gera um slug de URL a partir de um texto em português (remove acentos e símbolos). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Gera um código curto legível para uso humano (ex.: número de pedido). */
export function humanCode(prefix: string, sequence: number, pad = 6): string {
  return `${prefix}-${String(sequence).padStart(pad, '0')}`;
}
