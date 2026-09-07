/** Utilitários para interpretar erros do PostgreSQL (o Drizzle encapsula o erro original em `cause`). */

function pgError(
  error: unknown,
): { code?: string; constraint_name?: string; constraint?: string } | null {
  if (!error || typeof error !== 'object') return null;
  const direct = error as { code?: string; cause?: unknown };
  if (typeof direct.code === 'string') return direct as { code: string };
  if (direct.cause && typeof direct.cause === 'object') return pgError(direct.cause);
  return null;
}

export function pgErrorCode(error: unknown): string | undefined {
  return pgError(error)?.code;
}

/** Violação de unicidade (23505), opcionalmente restrita a uma constraint pelo nome (substring). */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = pgError(error);
  if (e?.code !== '23505') return false;
  if (!constraint) return true;
  return (e.constraint_name ?? e.constraint ?? '').includes(constraint);
}
