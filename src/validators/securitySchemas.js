import { z } from 'zod';

// Schema para validação de parâmetros de busca/query
export const searchQuerySchema = z.object({
  q: z.string()
    .max(100, 'Busca deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s]*$/, 'Busca contém caracteres inválidos')
    .optional()
    .transform(val => val?.trim()),
  
  category: z.string()
    .max(50, 'Categoria deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-Z0-9-]*$/, 'Categoria contém caracteres inválidos')
    .optional()
    .transform(val => val?.trim()),
  
  min_price: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Preço mínimo inválido')
    .optional()
    .transform(val => val ? parseFloat(val) : undefined),
    
  max_price: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Preço máximo inválido')
    .optional()
    .transform(val => val ? parseFloat(val) : undefined),
  
  page: z.string()
    .regex(/^\d+$/, 'Página deve ser um número')
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1),
    
  limit: z.string()
    .regex(/^\d+$/, 'Limite deve ser um número')
    .optional()
    .transform(val => val ? Math.min(parseInt(val, 10), 100) : 20) // Máximo 100 itens
}).refine(data => {
  if (data.min_price && data.max_price) {
    return data.min_price <= data.max_price;
  }
  return true;
}, {
  message: 'Preço mínimo deve ser menor que o preço máximo',
  path: ['max_price']
});

// Schema para validação de produtos query
export const productsQuerySchema = z.object({
  categoria_id: z.string()
    .uuid('ID da categoria inválido')
    .optional(),
  
  search: z.string()
    .max(100, 'Busca deve ter no máximo 100 caracteres')
    .optional()
    .transform(val => val?.trim()),
  
  ids: z.string()
    .max(1000, 'Lista de IDs muito longa')
    .optional()
}).passthrough(); // Permite outros campos sem validação estrita

// Schema para validação de IDs UUID
export const uuidParamsSchema = z.object({
  id: z.string()
    .uuid('ID deve ser um UUID válido')
    .transform(val => val.trim())
});

// Schema para validação de paginação
export const paginationSchema = z.object({
  page: z.number()
    .min(1, 'Página deve ser maior que 0')
    .max(1000, 'Página máxima é 1000')
    .default(1),
    
  limit: z.number()
    .min(1, 'Limite deve ser maior que 0')
    .max(100, 'Limite máximo é 100')
    .default(20)
});

// Schema para validação de ordenação
export const sortSchema = z.object({
  sort_by: z.enum(['created_at', 'updated_at', 'name', 'price'], {
    errorMap: () => ({ message: 'Campo de ordenação inválido' })
  }).optional().default('created_at'),
  
  sort_order: z.enum(['asc', 'desc'], {
    errorMap: () => ({ message: 'Ordem deve ser asc ou desc' })
  }).optional().default('desc')
});

// Schema para validação de filtros de data
export const dateRangeSchema = z.object({
  start_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial deve ter formato YYYY-MM-DD')
    .optional()
    .transform(val => val ? new Date(val) : undefined),
    
  end_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final deve ter formato YYYY-MM-DD')
    .optional()
    .transform(val => val ? new Date(val) : undefined)
}).refine(data => {
  if (data.start_date && data.end_date) {
    return data.start_date <= data.end_date;
  }
  return true;
}, {
  message: 'Data inicial deve ser anterior à data final',
  path: ['end_date']
});

// Schema para validação de upload de arquivos
export const fileUploadSchema = z.object({
  filename: z.string()
    .min(1, 'Nome do arquivo é obrigatório')
    .max(255, 'Nome do arquivo muito longo')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Nome do arquivo contém caracteres inválidos'),
    
  mimetype: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ], {
    errorMap: () => ({ message: 'Tipo de arquivo não permitido' })
  }),
  
  size: z.number()
    .max(5 * 1024 * 1024, 'Arquivo deve ter no máximo 5MB') // 5MB
});

// Schema para validação de checkout/pedido
export const checkoutSchema = z.object({
  address_id: z.string().uuid('ID do endereço inválido'),
  
  payment_method: z.enum(['pix', 'credit_card', 'debit_card'], {
    errorMap: () => ({ message: 'Método de pagamento inválido' })
  }),
  
  items: z.array(z.object({
    product_id: z.string().uuid('ID do produto inválido'),
    quantity: z.number()
      .min(1, 'Quantidade deve ser maior que 0')
      .max(10, 'Quantidade máxima é 10 por item')
      .int('Quantidade deve ser um número inteiro'),
    size: z.string()
      .max(10, 'Tamanho inválido')
      .regex(/^[A-Z0-9]+$/, 'Tamanho deve conter apenas letras maiúsculas e números')
      .optional()
  })).min(1, 'Pelo menos um item é obrigatório').max(50, 'Máximo 50 itens por pedido')
});

// Schema para validação de headers de segurança
export const securityHeadersSchema = z.object({
  'user-agent': z.string()
    .max(500, 'User-Agent muito longo')
    .optional(),
    
  'x-forwarded-for': z.string()
    .max(100, 'X-Forwarded-For muito longo')
    .optional(),
    
  'x-real-ip': z.string()
    .max(45, 'X-Real-IP muito longo') // IPv6 máximo
    .optional()
});

// Função para sanitizar strings removendo caracteres perigosos
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/\0/g, '') // Remove null bytes
    .slice(0, 10000); // Limita tamanho máximo
};

// Função para detectar padrões suspeitos
export const detectSuspiciousPatterns = (data) => {
  const suspiciousPatterns = [
    /union.*select/i,
    /drop.*table/i,
    /insert.*into/i,
    /delete.*from/i,
    /update.*set/i,
    /<script/i,
    /javascript:/i,
    /eval\(/i,
    /document\.cookie/i,
    /window\.location/i,
    /\.\.\/\.\.\//i, // Path traversal
    /\0/g, // Null bytes
    /\x00/g // Hex null bytes
  ];
  
  const dataString = JSON.stringify(data).toLowerCase();
  return suspiciousPatterns.some(pattern => pattern.test(dataString));
};

// Schema para validação de rate limiting
export const rateLimitSchema = z.object({
  ip: z.string().ip('IP inválido'),
  endpoint: z.string().max(200, 'Endpoint muito longo'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  timestamp: z.date()
});

export default {
  searchQuerySchema,
  productsQuerySchema,
  uuidParamsSchema,
  paginationSchema,
  sortSchema,
  dateRangeSchema,
  fileUploadSchema,
  checkoutSchema,
  securityHeadersSchema,
  sanitizeString,
  detectSuspiciousPatterns,
  rateLimitSchema
};
