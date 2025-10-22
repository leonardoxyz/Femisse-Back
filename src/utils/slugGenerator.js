/**
 * Gera slug a partir de uma string
 * Remove acentos, converte para minúsculas e substitui espaços por hífens
 */
export const generateSlug = (name) => {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífen
    .replace(/^-+|-+$/g, ''); // Remove hífens das extremidades
};
