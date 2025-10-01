import { z } from 'zod';

const numericStringToNumber = z
  .string()
  .trim()
  .transform((value) => {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isNaN(parsed)) {
      throw new Error('Valor numérico inválido');
    }
    return parsed;
  });

const numericField = z.union([z.number(), numericStringToNumber]).transform((value) => {
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isNaN(parsed)) {
      throw new Error('Valor numérico inválido');
    }
    return parsed;
  }
  return value;
});

const optionalNumericField = numericField.optional().nullable();

const booleanField = z
  .union([
    z.boolean(),
    z
      .string()
      .trim()
      .transform((value) => {
        const normalized = value.toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
        throw new Error('Valor booleano inválido');
      }),
  ])
  .optional();

const stringArrayField = z
  .array(z.string().trim().min(1))
  .optional()
  .transform((value) => value ?? []);

const productBaseSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  description: z.string().trim().max(5000).optional(),
  price: numericField,
  original_price: optionalNumericField,
  image: z.string().trim().min(1, 'Imagem principal é obrigatória'),
  images: stringArrayField,
  badge: z.string().trim().optional(),
  badge_variant: z.string().trim().optional(),
  sizes: stringArrayField,
  colors: stringArrayField,
  image_ids: z.array(z.string().trim().min(1)).optional(),
  in_stock: booleanField,
});

export const productCreateSchema = productBaseSchema;

export const productUpdateSchema = productBaseSchema.partial().superRefine((data, ctx) => {
  if (Object.keys(data).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pelo menos um campo deve ser fornecido para atualização',
    });
  }
});
