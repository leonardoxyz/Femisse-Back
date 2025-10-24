/**
 * DTO para Cartões - Remove dados sensíveis de cartões de crédito
 */

/**
 * Formata cartão (oculta dados sensíveis)
 */
export const toPublicCard = (card) => ({
  id: card.id,
  user_id: card.user_id,
  card_holder_name: card.card_holder_name,
  card_last_four: card.card_last_four || card.card_number?.slice(-4),
  card_brand: card.card_brand,
  expiration_month: card.expiration_month,
  expiration_year: card.expiration_year,
  is_default: card.is_default || false,
  created_at: card.created_at,
});

/**
 * Formata lista de cartões
 */
export const toPublicCardList = (cards) => {
  if (!Array.isArray(cards)) return [];
  return cards.map(toPublicCard);
};

/**
 * Formata resposta de criação de cartão
 */
export const toCardCreationResponse = (card) => ({
  id: card.id,
  card_holder_name: card.card_holder_name,
  card_last_four: card.card_last_four,
  card_brand: card.card_brand,
  expiration_month: card.expiration_month,
  expiration_year: card.expiration_year,
  is_default: card.is_default || false,
  message: 'Cartão adicionado com sucesso',
});

/**
 * Formata resposta de exclusão de cartão
 */
export const toCardDeletionResponse = (cardId) => ({
  id: cardId,
  message: 'Cartão removido com sucesso',
});

/**
 * Formata informações de cartão para pagamento (tokenizado)
 */
export const toPaymentCardInfo = (card) => ({
  card_last_four: card.card_last_four,
  card_brand: card.card_brand,
  card_holder_name: card.card_holder_name,
});
