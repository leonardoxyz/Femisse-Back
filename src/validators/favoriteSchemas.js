import { z } from 'zod';

export const favoriteBodySchema = z.object({
  productId: z
    .union([
      z.string().trim().min(1, 'productId é obrigatório'),
      z.number().int().positive(),
    ])
    .transform((value) => (typeof value === 'number' ? String(value) : value.trim())),
});

export const favoriteParamSchema = z.object({
  productId: z
    .union([
      z.string().trim().min(1, 'productId é obrigatório'),
      z.number().int().positive(),
    ])
    .transform((value) => (typeof value === 'number' ? String(value) : value.trim())),
});
