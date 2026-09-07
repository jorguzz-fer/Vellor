import { useCallback, useState } from 'react';
import type { z } from 'zod';
import { ApiError } from './api';

export type FieldErrors = Record<string, string | undefined>;

/**
 * Formulário mínimo com validação Zod (mesmos schemas da API) e mapeamento de
 * erros de campo vindos do servidor (RFC 7807 `errors`).
 */
export function useZodForm<TSchema extends z.ZodType>(
  schema: TSchema,
  initial: Record<string, unknown>,
) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  }, []);

  const reset = useCallback(
    (next?: Record<string, unknown>) => {
      setValues(next ?? initial);
      setErrors({});
      setFormError(null);
    },
    [initial],
  );

  const validate = useCallback((): z.output<TSchema> | null => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data as z.output<TSchema>;
    }
    const next: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path.map(String).join('.') || '_';
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return null;
  }, [schema, values]);

  const handleSubmit = useCallback(
    (onValid: (data: z.output<TSchema>) => Promise<void> | void) =>
      async (event?: { preventDefault?: () => void }) => {
        event?.preventDefault?.();
        setFormError(null);
        const data = validate();
        if (!data) return;
        setSubmitting(true);
        try {
          await onValid(data);
        } catch (error) {
          if (error instanceof ApiError) {
            if (error.errors) {
              const next: FieldErrors = {};
              for (const [field, messages] of Object.entries(error.errors))
                next[field] = messages[0];
              setErrors(next);
            }
            setFormError(error.message);
          } else {
            setFormError(error instanceof Error ? error.message : 'Erro inesperado');
          }
        } finally {
          setSubmitting(false);
        }
      },
    [validate],
  );

  return {
    values,
    setField,
    setValues,
    errors,
    setErrors,
    formError,
    setFormError,
    submitting,
    handleSubmit,
    reset,
    validate,
  };
}
