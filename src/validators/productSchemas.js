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

const nonNegativeIntegerField = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .regex(/^\d+$/, 'Estoque deve ser um número inteiro não negativo')
      .transform((value) => Number(value)),
  ])
  .transform((value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      throw new Error('Estoque deve ser um número inteiro não negativo');
    }
    return parsed;
  });

const variantSizeSchema = z.object({
  size: z.string().trim().min(1, 'Tamanho é obrigatório'),
  stock: nonNegativeIntegerField,
  price: optionalNumericField,
});

const variantSchema = z
  .object({
    color: z.union([z.string().trim().min(1), z.null()]).optional(),
    image: z.string().trim().min(1).optional(),
    sizes: z.array(variantSizeSchema).min(1, 'Informe ao menos um tamanho para a variante'),
  })
  .transform((value) => ({
    color: value.color === undefined ? null : value.color,
    image: value.image ?? null,
    sizes: value.sizes,
  }));

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
  variants: z.array(variantSchema).optional().transform((value) => value ?? []),
  image_ids: z.array(z.string().trim().min(1)).optional(),
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
