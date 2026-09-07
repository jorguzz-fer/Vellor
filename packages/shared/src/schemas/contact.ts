import { z } from 'zod';
import { CONTACT_SUBJECTS } from '../enums.js';
import { EmailSchema, PhoneSchema } from './auth.js';

export const ContactInputSchema = z.object({
  name: z.string().trim().min(3, 'Informe seu nome').max(120),
  email: EmailSchema,
  phone: PhoneSchema.optional(),
  subject: z.enum(CONTACT_SUBJECTS),
  message: z.string().trim().min(10, 'Conte um pouco mais para podermos ajudar').max(2000),
  productId: z.uuid().optional(),
  consent: z.literal(true, { error: 'É preciso autorizar o contato' }),
  /** Campo honeypot: deve permanecer vazio. */
  website: z.string().max(0).optional(),
});
export type ContactInput = z.infer<typeof ContactInputSchema>;

export const NewsletterInputSchema = z.object({
  email: EmailSchema,
  name: z.string().trim().max(120).optional(),
  consent: z.literal(true, { error: 'É preciso autorizar o envio de comunicações' }),
  source: z.string().max(40).optional(),
  website: z.string().max(0).optional(),
});
export type NewsletterInput = z.infer<typeof NewsletterInputSchema>;
