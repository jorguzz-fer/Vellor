import { z } from 'zod';
import { USER_ROLES } from '../enums.js';
import { isValidCPF, isValidPhone, normalizeCPF, normalizePhone } from '../validators.js';

export const PasswordSchema = z
  .string()
  .min(10, 'A senha deve ter pelo menos 10 caracteres')
  .max(128, 'A senha deve ter no máximo 128 caracteres');

export const EmailSchema = z
  .email('E-mail inválido')
  .max(160)
  .transform((v) => v.trim().toLowerCase());

export const PhoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine(isValidPhone, 'Telefone inválido. Informe DDD e número.');

export const CpfSchema = z.string().transform(normalizeCPF).refine(isValidCPF, 'CPF inválido');

export const RegisterInputSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome completo').max(120),
  email: EmailSchema,
  password: PasswordSchema,
  phone: PhoneSchema.optional(),
  acceptTerms: z.literal(true, {
    error: 'É preciso aceitar os termos e a política de privacidade',
  }),
  newsletterOptIn: z.boolean().optional().default(false),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Informe a senha').max(128),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const ForgotPasswordInputSchema = z.object({ email: EmailSchema });
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(20).max(200),
  password: PasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const TotpCodeSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, ''))
  .refine((v) => /^\d{6}$/.test(v), 'Código de 6 dígitos inválido');

export const MfaVerifyInputSchema = z.object({ code: TotpCodeSchema });
export type MfaVerifyInput = z.infer<typeof MfaVerifyInputSchema>;

export const MfaSetupResponseSchema = z.object({
  otpauthUrl: z.string(),
  qrCodeDataUrl: z.string(),
  secretMasked: z.string(),
});
export type MfaSetupResponse = z.infer<typeof MfaSetupResponseSchema>;

export const UpdateProfileInputSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  phone: PhoneSchema.optional(),
  cpf: CpfSchema.optional(),
  newsletterOptIn: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

export const MeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  role: z.enum(USER_ROLES),
  phone: z.string().nullable(),
  cpfMasked: z.string().nullable(),
  mfaEnabled: z.boolean(),
  mfaVerified: z.boolean(),
  newsletterOptIn: z.boolean(),
  createdAt: z.string(),
});
export type Me = z.infer<typeof MeSchema>;

export const AuthStatusSchema = z.object({
  authenticated: z.boolean(),
  user: MeSchema.nullable(),
  /** Quando true, o admin precisa concluir o cadastro do MFA antes de usar o painel. */
  mfaSetupRequired: z.boolean(),
  /** Quando true, a sessão existe mas o segundo fator ainda não foi verificado. */
  mfaPending: z.boolean(),
});
export type AuthStatus = z.infer<typeof AuthStatusSchema>;
