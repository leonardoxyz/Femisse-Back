const toPublicAddress = (address) => ({
  cep: address.cep,
  street: address.street ?? address.rua ?? null,
  number: address.number ?? address.numero ?? null,
  complement: address.complement ?? address.complemento ?? null,
  neighborhood: address.neighborhood ?? address.bairro ?? null,
  city: address.city ?? address.cidade ?? null,
  state: address.state ?? address.estado ?? null,
  isDefault: address.is_default ?? address.isDefault ?? false,
});

const toPublicAddressList = (addresses = []) =>
  (Array.isArray(addresses) ? addresses : []).map(toPublicAddress);

const toAdminAddress = (address) => ({
  id: address.id,
  usuarioId: address.usuario_id,
  cep: address.cep,
  street: address.street ?? address.rua ?? null,
  number: address.number ?? address.numero ?? null,
  complement: address.complement ?? address.complemento ?? null,
  neighborhood: address.neighborhood ?? address.bairro ?? null,
  city: address.city ?? address.cidade ?? null,
  state: address.state ?? address.estado ?? null,
  isDefault: address.is_default ?? address.isDefault ?? false,
  createdAt: address.created_at,
  updatedAt: address.updated_at,
});

const toAdminAddressList = (addresses = []) =>
  (Array.isArray(addresses) ? addresses : []).map(toAdminAddress);

const validateAddressInput = (input) => {
  const errors = [];

  if (!input) {
    errors.push({ field: 'body', message: 'Dados do endereço são obrigatórios' });
    return { isValid: false, errors };
  }

  if (!input.cep) {
    errors.push({ field: 'cep', message: 'CEP é obrigatório' });
  }

  if (!input.street && !input.rua) {
    errors.push({ field: 'street', message: 'Rua é obrigatória' });
  }

  if (!input.number && !input.numero) {
    errors.push({ field: 'number', message: 'Número é obrigatório' });
  }

  if (!input.neighborhood && !input.bairro) {
    errors.push({ field: 'neighborhood', message: 'Bairro é obrigatório' });
  }

  if (!input.city && !input.cidade) {
    errors.push({ field: 'city', message: 'Cidade é obrigatória' });
  }

  if (!input.state && !input.estado) {
    errors.push({ field: 'state', message: 'Estado é obrigatório' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const sanitizeAddressInput = (input) => ({
  cep: input.cep?.trim(),
  street: input.street?.trim() || input.rua?.trim(),
  number: input.number?.trim() || input.numero?.trim(),
  complement: input.complement?.trim() || input.complemento?.trim() || null,
  neighborhood: input.neighborhood?.trim() || input.bairro?.trim(),
  city: input.city?.trim() || input.cidade?.trim(),
  state: input.state?.trim() || input.estado?.trim(),
  is_default: input.is_default ?? input.isDefault ?? false,
});

export {
  toPublicAddress,
  toPublicAddressList,
  toAdminAddress,
  toAdminAddressList,
  validateAddressInput,
  sanitizeAddressInput,
};
