/**
 * DTO para Shipping (MelhorEnvio) - Formata respostas de envio
 */

/**
 * Formata cotação de frete
 */
export const toShippingQuote = (quote) => ({
  id: quote.id,
  name: quote.name,
  company: quote.company?.name || quote.company,
  price: quote.price,
  custom_price: quote.custom_price || quote.price,
  discount: quote.discount || 0,
  currency: quote.currency || 'BRL',
  delivery_time: quote.delivery_time,
  delivery_range: quote.delivery_range || null,
  packages: quote.packages || [],
  additional_services: quote.additional_services || {},
});

/**
 * Formata lista de cotações
 */
export const toShippingQuoteList = (quotes) => {
  if (!Array.isArray(quotes)) return [];
  return quotes.map(toShippingQuote);
};

/**
 * Formata etiqueta de envio
 */
export const toShippingLabel = (label) => ({
  id: label.id,
  order_id: label.order_id,
  protocol: label.protocol || null,
  tracking_code: label.tracking_code || null,
  status: label.status,
  service_id: label.service_id,
  agency_id: label.agency_id || null,
  label_url: label.label_url || null,
  price: label.price,
  generated_at: label.generated_at || null,
  posted_at: label.posted_at || null,
  created_at: label.created_at,
});

/**
 * Formata lista de etiquetas
 */
export const toShippingLabelList = (labels) => {
  if (!Array.isArray(labels)) return [];
  return labels.map(toShippingLabel);
};

/**
 * Formata rastreamento de envio
 */
export const toShippingTracking = (tracking) => ({
  tracking_code: tracking.tracking_code,
  status: tracking.status,
  status_description: tracking.status_description || null,
  events: tracking.events?.map(event => ({
    date: event.date,
    status: event.status,
    description: event.description,
    location: event.location || null,
  })) || [],
  estimated_delivery: tracking.estimated_delivery || null,
  last_update: tracking.last_update || null,
});

/**
 * Formata evento de rastreamento
 */
export const toShippingEvent = (event) => ({
  id: event.id,
  shipping_label_id: event.shipping_label_id,
  event_type: event.event_type,
  status: event.status,
  description: event.description,
  location: event.location || null,
  date: event.date,
  created_at: event.created_at,
});

/**
 * Formata lista de eventos
 */
export const toShippingEventList = (events) => {
  if (!Array.isArray(events)) return [];
  return events.map(toShippingEvent);
};

export const toOrderTracking = (label, events = []) => {
  if (!label) {
    return null;
  }

  const safeEvents = Array.isArray(events) ? events : [];

  return {
    orderId: label.order_id,
    labelId: label.id,
    status: label.status,
    trackingCode: label.tracking_code ?? null,
    trackingUrl: label.tracking_url ?? null,
    protocol: label.protocol ?? null,
    serviceName: label.service_name ?? null,
    companyName: label.company_name ?? null,
    melhorEnvioOrderId: label.melhorenvio_order_id ?? null,
    price: typeof label.price === 'number' ? label.price : null,
    postedAt: label.posted_at ?? null,
    deliveredAt: label.delivered_at ?? null,
    createdAt: label.created_at ?? null,
    updatedAt: label.updated_at ?? null,
    lastUpdate: safeEvents.length > 0 ? safeEvents[0]?.created_at ?? null : label.updated_at ?? label.created_at ?? null,
    events: safeEvents.map((event) => ({
      id: event.id,
      type: event.event_type,
      status: event.status,
      processed: event.processed ?? false,
      processedAt: event.processed_at ?? null,
      createdAt: event.created_at ?? null,
      description: event.description ?? null,
      location: event.location ?? null,
      trackingCode: event.tracking_code ?? null,
      errorMessage: event.error_message ?? null,
    })),
  };
};

/**
 * Formata status de autorização MelhorEnvio
 */
export const toAuthorizationStatus = (token) => ({
  authorized: !!token,
  mode: 'oauth2',
  expires_at: token?.expires_at || null,
  authorized_since: token?.created_at || null,
});
