/**
 * DTO para endereço público
 * Retorna apenas dados necessários para o frontend
 * Não expõe IDs internos do banco
 */
const toPublicAddress = (address) => ({
  label: address.label ?? null,
  zip_code: address.zip_code ?? address.cep ?? null,
  street: address.street ?? address.rua ?? null,
  number: address.number ?? address.numero ?? null,
  complement: address.complement ?? address.complemento ?? null,
  neighborhood: address.neighborhood ?? address.bairro ?? null,
  city: address.city ?? address.cidade ?? null,
  state: address.state ?? address.estado ?? null,
  is_default: address.is_default ?? address.isDefault ?? false,
});

const toPublicAddressList = (addresses = []) =>
  (Array.isArray(addresses) ? addresses : []).map(toPublicAddress);

export {
  toPublicAddress,
  toPublicAddressList,
};
