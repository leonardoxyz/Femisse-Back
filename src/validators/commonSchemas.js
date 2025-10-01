import { z } from 'zod';

export const nameSchema = z
  .string({ required_error: 'Nome é obrigatório' })
  .trim()
  .min(2, 'Nome deve ter ao menos 2 caracteres')
  .max(100, 'Nome deve ter no máximo 100 caracteres')
  .regex(/^[A-Za-zÀ-ÖØ-öø-ÿ'\s]+$/, 'Nome deve conter apenas letras e espaços');

export const emailSchema = z
  .string({ required_error: 'Email é obrigatório' })
  .trim()
  .email('Email inválido');

export const passwordSchema = z
  .string({ required_error: 'Senha é obrigatória' })
  .min(6, 'Senha deve ter pelo menos 6 caracteres')
  .max(100, 'Senha deve ter no máximo 100 caracteres');

export const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .superRefine((value, ctx) => {
    if (!value) return;
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data inválida',
      });
      return;
    }
    const date = new Date(timestamp);
    const now = new Date();
    if (date > now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data não pode ser futura',
      });
    }
  });

const invalidCpfRegex = /^([0-9])\1{10}$/;

export const optionalCpfSchema = z
  .string()
  .trim()
  .optional()
  .superRefine((value, ctx) => {
    if (!value) return;
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 11 || invalidCpfRegex.test(digits)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CPF inválido',
      });
    }
  })
  .transform((value) => {
    if (!value) return undefined;
    return value.replace(/\D/g, '');
  });

export const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .superRefine((value, ctx) => {
    if (!value) return;
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Telefone deve ter 10 ou 11 dígitos',
      });
    }
  })
  .transform((value) => {
    if (!value) return undefined;
    return value.replace(/\D/g, '');
  });

export const zipcodeSchema = z
  .string({ required_error: 'CEP é obrigatório' })
  .trim()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => digits.length === 8, {
    message: 'CEP deve ter 8 dígitos',
  });

export const optionalBooleanSchema = z
  .union([z.boolean(), z.string().transform((value) => value.trim().toLowerCase())])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (!value) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error('Valor booleano inválido');
  });
