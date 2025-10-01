import { z } from 'zod';
import { optionalBooleanSchema, zipcodeSchema } from './commonSchemas.js';

const maxLength = (field, length) =>
  z
    .string({ required_error: `${field} é obrigatório` })
    .trim()
    .min(1, `${field} é obrigatório`)
    .max(length, `${field} deve ter no máximo ${length} caracteres`);

const optionalTrimmedString = (length) =>
  z
    .string()
    .trim()
    .max(length, `Campo deve ter no máximo ${length} caracteres`)
    .optional()
    .transform((value) => (value === undefined || value === '' ? undefined : value));

const addressNumberSchema = z
  .union([
    z
      .string({ required_error: 'Número é obrigatório' })
      .trim()
      .min(1, 'Número é obrigatório')
      .max(20, 'Número deve ter no máximo 20 caracteres'),
    z
      .number({ required_error: 'Número é obrigatório' })
      .positive('Número deve ser positivo')
      .max(9999999999, 'Número inválido'),
  ])
  .transform((value) => (typeof value === 'number' ? String(value) : value));

const stateSchema = z
  .string({ required_error: 'Estado é obrigatório' })
  .trim()
  .length(2, 'Estado deve possuir 2 caracteres')
  .transform((value) => value.toUpperCase());

const addressBaseSchema = z.object({
  label: maxLength('Identificação', 100),
  street: maxLength('Rua', 150),
  number: addressNumberSchema,
  complement: optionalTrimmedString(100),
  neighborhood: maxLength('Bairro', 100),
  city: maxLength('Cidade', 100),
  state: stateSchema,
  zip_code: zipcodeSchema,
  is_default: optionalBooleanSchema.default(false),
});

export const addressCreateSchema = addressBaseSchema;

export const addressUpdateSchema = addressBaseSchema.partial().superRefine((values, ctx) => {
  const hasUpdates = Object.values(values).some((value) => value !== undefined);
  if (!hasUpdates) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pelo menos um campo deve ser fornecido para atualização',
    });
  }
});

export const addressParamsSchema = z.object({
  id: z.string({ required_error: 'ID é obrigatório' }).trim().min(1, 'ID é obrigatório'),
});

export const addressListQuerySchema = z.object({
  usuario_id: z.string().trim().min(1).optional(),
});
