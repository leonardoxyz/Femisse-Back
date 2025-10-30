import { z } from 'zod';

export const categoryCreateSchema = z.object({
  name: z
    .string({ required_error: 'Nome é obrigatório' })
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  image: z
    .string()
    .trim()
    .url('Imagem deve ser uma URL válida')
    .optional(),
  link: z
    .string()
    .trim()
    .url('Link deve ser uma URL válida')
    .optional(),
  show_in_home_grid: z
    .boolean()
    .optional()
    .default(false),
});
