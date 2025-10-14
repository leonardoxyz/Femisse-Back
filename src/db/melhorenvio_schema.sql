-- =====================================================
-- SCHEMA MELHOR ENVIO - INTEGRAÇÃO DE FRETES
-- =====================================================
-- Criado para gerenciar cotações, etiquetas e rastreamento
-- de envios através da API do Melhor Envio
-- =====================================================

-- Tabela para armazenar tokens OAuth2 do MelhorEnvio
CREATE TABLE IF NOT EXISTS melhorenvio_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Índice para busca rápida por usuário
CREATE INDEX IF NOT EXISTS idx_melhorenvio_tokens_user_id ON melhorenvio_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_melhorenvio_tokens_expires_at ON melhorenvio_tokens(expires_at);

-- Tabela para armazenar cotações de frete
CREATE TABLE IF NOT EXISTS shipping_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Dados da cotação
  service_id INTEGER NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  company_id INTEGER NOT NULL,
  company_name VARCHAR(100) NOT NULL,
  company_picture TEXT,
  
  -- Valores e prazos
  price DECIMAL(10, 2) NOT NULL,
  custom_price DECIMAL(10, 2),
  discount DECIMAL(10, 2) DEFAULT 0,
  delivery_time INTEGER NOT NULL, -- em dias
  custom_delivery_time INTEGER,
  delivery_range JSON, -- {min: number, max: number}
  
  -- Dimensões e peso
  packages JSON NOT NULL, -- Array de pacotes com dimensões
  
  -- Endereços
  from_zip_code VARCHAR(9) NOT NULL,
  to_zip_code VARCHAR(9) NOT NULL,
  
  -- Opções adicionais
  additional_services JSON, -- {receipt: boolean, own_hand: boolean, collect: boolean}
  insurance_value DECIMAL(10, 2),
  
  -- Metadados
  quote_data JSON, -- Resposta completa da API
  is_selected BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_user_id ON shipping_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_order_id ON shipping_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_created_at ON shipping_quotes(created_at DESC);

-- Tabela para armazenar etiquetas de envio
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES shipping_quotes(id) ON DELETE SET NULL,
  
  -- IDs do MelhorEnvio
  melhorenvio_order_id VARCHAR(100) UNIQUE NOT NULL, -- UUID retornado pela API
  protocol VARCHAR(50) UNIQUE, -- ORD-2024XXXXXXXXXX
  
  -- Dados do serviço
  service_id INTEGER NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  company_id INTEGER NOT NULL,
  company_name VARCHAR(100) NOT NULL,
  
  -- Status da etiqueta
  status VARCHAR(50) DEFAULT 'pending', -- pending, released, generated, posted, delivered, cancelled, etc.
  payment_status VARCHAR(50) DEFAULT 'pending',
  
  -- Rastreamento
  tracking_code VARCHAR(50),
  tracking_url TEXT,
  self_tracking TEXT,
  
  -- Valores
  price DECIMAL(10, 2) NOT NULL,
  discount DECIMAL(10, 2) DEFAULT 0,
  insurance_value DECIMAL(10, 2),
  
  -- URLs e documentos
  label_url TEXT, -- URL da etiqueta PDF
  invoice_key VARCHAR(44), -- Chave da nota fiscal
  
  -- Datas importantes
  paid_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  
  -- Dados completos da API
  api_response JSON,
  
  -- Tags personalizadas
  tags JSON, -- [{tag: string, url: string}]
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_shipping_labels_order_id ON shipping_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_user_id ON shipping_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_status ON shipping_labels(status);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking_code ON shipping_labels(tracking_code);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_protocol ON shipping_labels(protocol);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_created_at ON shipping_labels(created_at DESC);

-- Tabela para eventos de rastreamento (webhooks)
CREATE TABLE IF NOT EXISTS shipping_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_label_id UUID NOT NULL REFERENCES shipping_labels(id) ON DELETE CASCADE,
  
  -- Dados do evento
  event_type VARCHAR(50) NOT NULL, -- order.created, order.posted, order.delivered, etc.
  status VARCHAR(50) NOT NULL,
  
  -- Dados do webhook
  melhorenvio_order_id VARCHAR(100) NOT NULL,
  protocol VARCHAR(50),
  tracking_code VARCHAR(50),
  
  -- Payload completo
  webhook_payload JSON NOT NULL,
  webhook_signature VARCHAR(255), -- X-ME-Signature para validação
  
  -- Metadados
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_shipping_events_label_id ON shipping_events(shipping_label_id);
CREATE INDEX IF NOT EXISTS idx_shipping_events_event_type ON shipping_events(event_type);
CREATE INDEX IF NOT EXISTS idx_shipping_events_created_at ON shipping_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipping_events_processed ON shipping_events(processed);

-- Tabela para logs de sincronização e erros
CREATE TABLE IF NOT EXISTS melhorenvio_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  shipping_label_id UUID REFERENCES shipping_labels(id) ON DELETE SET NULL,
  
  -- Tipo de operação
  operation_type VARCHAR(50) NOT NULL, -- quote, create_label, webhook, refresh_token, etc.
  
  -- Status
  status VARCHAR(20) NOT NULL, -- success, error, warning
  
  -- Detalhes
  message TEXT,
  request_data JSON,
  response_data JSON,
  error_details JSON,
  
  -- Metadados
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para análise e debugging
CREATE INDEX IF NOT EXISTS idx_melhorenvio_logs_user_id ON melhorenvio_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_melhorenvio_logs_operation_type ON melhorenvio_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_melhorenvio_logs_status ON melhorenvio_logs(status);
CREATE INDEX IF NOT EXISTS idx_melhorenvio_logs_created_at ON melhorenvio_logs(created_at DESC);

-- =====================================================
-- TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_melhorenvio_tokens_updated_at
  BEFORE UPDATE ON melhorenvio_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipping_labels_updated_at
  BEFORE UPDATE ON shipping_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE melhorenvio_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE melhorenvio_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para melhorenvio_tokens
CREATE POLICY "Usuários podem ver seus próprios tokens"
  ON melhorenvio_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios tokens"
  ON melhorenvio_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios tokens"
  ON melhorenvio_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- Políticas para shipping_quotes
CREATE POLICY "Usuários podem ver suas próprias cotações"
  ON shipping_quotes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar cotações"
  ON shipping_quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Políticas para shipping_labels
CREATE POLICY "Usuários podem ver suas próprias etiquetas"
  ON shipping_labels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar etiquetas"
  ON shipping_labels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Políticas para shipping_events
CREATE POLICY "Usuários podem ver eventos de suas etiquetas"
  ON shipping_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shipping_labels
      WHERE shipping_labels.id = shipping_events.shipping_label_id
      AND shipping_labels.user_id = auth.uid()
    )
  );

-- Políticas para melhorenvio_logs (apenas leitura para usuários)
CREATE POLICY "Usuários podem ver seus próprios logs"
  ON melhorenvio_logs FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para limpar tokens expirados (executar via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM melhorenvio_tokens
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para limpar cotações expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_quotes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shipping_quotes
  WHERE expires_at < NOW() AND is_selected = false;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para obter status atual de uma etiqueta
CREATE OR REPLACE FUNCTION get_shipping_label_status(label_id UUID)
RETURNS TABLE (
  current_status VARCHAR(50),
  last_event_type VARCHAR(50),
  last_update TIMESTAMPTZ,
  tracking_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.status,
    se.event_type,
    se.created_at,
    sl.tracking_url
  FROM shipping_labels sl
  LEFT JOIN LATERAL (
    SELECT event_type, created_at
    FROM shipping_events
    WHERE shipping_label_id = sl.id
    ORDER BY created_at DESC
    LIMIT 1
  ) se ON true
  WHERE sl.id = label_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE melhorenvio_tokens IS 'Armazena tokens OAuth2 do MelhorEnvio por usuário';
COMMENT ON TABLE shipping_quotes IS 'Cotações de frete realizadas via API MelhorEnvio';
COMMENT ON TABLE shipping_labels IS 'Etiquetas de envio criadas e gerenciadas pelo MelhorEnvio';
COMMENT ON TABLE shipping_events IS 'Eventos de rastreamento recebidos via webhook';
COMMENT ON TABLE melhorenvio_logs IS 'Logs de operações e erros da integração MelhorEnvio';

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================
