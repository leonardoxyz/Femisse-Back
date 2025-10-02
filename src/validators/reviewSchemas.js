import { z } from 'zod';

export const reviewParamsSchema = z.object({
  id: z.string({ required_error: 'ID é obrigatório' }).uuid('ID inválido'),
});

export const reviewCreateSchema = z.object({
  product_id: z.string({ required_error: 'product_id é obrigatório' }).uuid('product_id inválido'),
  order_id: z.string({ required_error: 'order_id é obrigatório' }).uuid('order_id inválido'),
  rating: z.coerce
    .number({ required_error: 'rating é obrigatório' })
    .int('rating deve ser um número inteiro')
    .min(1, 'rating deve ser no mínimo 1')
    .max(5, 'rating deve ser no máximo 5'),
  comment: z
    .string({ required_error: 'comment é obrigatório' })
    .trim()
    .min(10, 'O comentário deve ter pelo menos 10 caracteres')
    .max(2000, 'O comentário deve ter no máximo 2000 caracteres'),
});

export const reviewUpdateSchema = reviewCreateSchema.partial().superRefine((values, ctx) => {
  if (values.rating === undefined && values.comment === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe rating ou comment para atualizar',
    });
  }

  if (values.comment !== undefined) {
    const trimmed = values.comment.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O comentário não pode ser vazio',
      });
    }
  }
});
