import { z } from 'zod';
import {
  nameSchema,
  emailSchema,
  optionalDateSchema,
  optionalCpfSchema,
  optionalPhoneSchema,
} from './commonSchemas.js';

const uuidSchema = z.string({ required_error: 'ID é obrigatório' }).uuid('ID inválido');

export const userParamsSchema = z.object({
  id: uuidSchema,
});

export const userCreateSchema = z.object({
  nome: nameSchema,
  data_nascimento: optionalDateSchema,
  cpf: optionalCpfSchema,
  telefone: optionalPhoneSchema,
  email: emailSchema,
  senha_hash: z
    .string({ required_error: 'Hash da senha é obrigatória' })
    .trim()
    .min(60, 'Hash da senha deve ter pelo menos 60 caracteres')
    .max(200, 'Hash da senha muito longa'),
});

export const userUpdateSchema = z
  .object({
    nome: nameSchema.optional(),
    data_nascimento: optionalDateSchema,
    cpf: optionalCpfSchema,
    telefone: optionalPhoneSchema,
    email: emailSchema.optional(),
  })
  .superRefine((values, ctx) => {
    const hasUpdates = Object.values(values).some((value) => value !== undefined);
    if (!hasUpdates) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pelo menos um campo deve ser fornecido para atualização',
      });
    }
  });

export const profileUpdateSchema = z
  .object({
    nome: nameSchema.optional(),
    data_nascimento: optionalDateSchema,
    cpf: optionalCpfSchema,
    telefone: optionalPhoneSchema,
    email: emailSchema.optional(),
  })
  .superRefine((values, ctx) => {
    const hasUpdates = Object.values(values).some((value) => value !== undefined);
    if (!hasUpdates) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pelo menos um campo deve ser fornecido para atualização',
      });
    }
  });
