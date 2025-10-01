import { z } from 'zod';
import {
  nameSchema,
  emailSchema,
  passwordSchema,
  optionalDateSchema,
  optionalCpfSchema,
  optionalPhoneSchema,
} from './commonSchemas.js';

export const registerSchema = z.object({
  nome: nameSchema,
  data_nascimento: optionalDateSchema,
  cpf: optionalCpfSchema,
  telefone: optionalPhoneSchema,
  email: emailSchema,
  senha: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  senha: passwordSchema,
});
