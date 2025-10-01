import { ZodError } from 'zod';

const TARGET_PROPERTY_MAP = {
  body: 'validatedBody',
  query: 'validatedQuery',
  params: 'validatedParams',
};

export const validateRequest = (schema, target = 'body') => async (req, res, next) => {
  try {
    const data = req[target];
    const parsed = await schema.parseAsync(data);
    const property = TARGET_PROPERTY_MAP[target] || TARGET_PROPERTY_MAP.body;
    req[property] = parsed;
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      const formatted = error.errors.map(({ path, message }) => ({
        path: path.join('.') || undefined,
        message,
      }));
      return res.status(400).json({ error: 'Dados inválidos', details: formatted });
    }

    return res.status(500).json({ error: 'Erro ao validar dados', details: error.message });
  }
};
