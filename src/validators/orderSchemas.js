import { z } from 'zod';

const requiredString = (field, max = 255) =>
  z
    .string({ required_error: `${field} é obrigatório` })
    .trim()
    .min(1, `${field} é obrigatório`)
    .max(max, `${field} deve ter no máximo ${max} caracteres`);

const optionalString = (field, max = 255) =>
  z
    .string()
    .trim()
    .max(max, `${field} deve ter no máximo ${max} caracteres`)
    .optional()
    .transform((value) => (value === undefined || value === '' ? undefined : value));

const moneySchema = z.coerce.number().min(0, 'Valor deve ser maior ou igual a zero');

export const orderStatusEnum = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const paymentStatusEnum = z.enum([
  'pending',
  'paid',
  'failed',
  'refunded',
]);

export const orderItemSchema = z
  .object({
    // Agora product_id é opcional; aceita string genérica (UUID validado no controller)
    product_id: z.string().trim().min(1).optional(),
    // product_slug como alternativa segura
    product_slug: z
      .string()
      .trim()
      .min(1, 'product_slug é obrigatório quando não houver product_id')
      .optional(),
    product_name: requiredString('Nome do produto', 255),
    product_image: optionalString('Imagem do produto', 500),
    quantity: z.coerce.number().int().positive('Quantidade deve ser maior que zero'),
    unit_price: moneySchema,
    variant_size: optionalString('Tamanho', 50),
    variant_color: optionalString('Cor', 50),
  })
  .refine((item) => !!item.product_id || !!item.product_slug, {
    message: 'Informe product_id (UUID) ou product_slug',
    path: ['product_id'],
  });

const shippingSchema = z.object({
  name: requiredString('Nome do destinatário', 150),
  street: requiredString('Rua', 150),
  number: requiredString('Número', 20),
  complement: optionalString('Complemento', 100),
  neighborhood: requiredString('Bairro', 100),
  city: requiredString('Cidade', 100),
  state: z
    .string({ required_error: 'Estado é obrigatório' })
    .trim()
    .length(2, 'Estado deve conter 2 caracteres')
    .transform((value) => value.toUpperCase()),
  zip_code: z
    .string({ required_error: 'CEP é obrigatório' })
    .trim()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length === 8, { message: 'CEP deve conter 8 dígitos' }),
});

export const orderCreateSchema = z.object({
  payment_method: requiredString('Método de pagamento', 100),
  payment_status: paymentStatusEnum.default('pending'),
  shipping_cost: moneySchema.default(0),
  discount: moneySchema.default(0),
  subtotal: moneySchema.optional(),
  total: moneySchema.optional(),
  items: z.array(orderItemSchema).min(1, 'Inclua pelo menos um item no pedido'),
  notes: optionalString('Observações', 500),
  shipping: shippingSchema,
  coupon_id: z.string().uuid('coupon_id inválido').optional(),
  coupon_code: optionalString('Código do cupom', 50),
  coupon_discount: moneySchema.optional(),
});

export const orderUpdateSchema = z
  .object({
    status: orderStatusEnum.optional(),
    payment_status: paymentStatusEnum.optional(),
    tracking_code: optionalString('Código de rastreio', 120),
    shipping_cost: moneySchema.optional(),
    discount: moneySchema.optional(),
    subtotal: moneySchema.optional(),
    total: moneySchema.optional(),
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

export const orderParamsSchema = z.object({
  id: z.string({ required_error: 'ID é obrigatório' }).uuid('ID inválido'),
});

export const orderListQuerySchema = z.object({
  user_id: z.string().uuid('user_id inválido').optional(),
  status: orderStatusEnum.optional(),
  payment_status: paymentStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const orderUserListQuerySchema = orderListQuerySchema.omit({ user_id: true, payment_status: true });
