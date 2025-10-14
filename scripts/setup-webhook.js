/**
 * SCRIPT PARA CONFIGURAR WEBHOOK DO MELHOR ENVIO
 * 
 * Execute este script uma vez para registrar o webhook
 * node scripts/setup-webhook.js
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const MELHORENVIO_API_URL = process.env.MELHORENVIO_SANDBOX === 'true'
  ? 'https://sandbox.melhorenvio.com.br/api/v2'
  : 'https://melhorenvio.com.br/api/v2';

const CLIENT_ID = process.env.MELHORENVIO_CLIENT_ID;
const CLIENT_SECRET = process.env.MELHORENVIO_CLIENT_SECRET;

async function setupWebhook() {
  try {
    console.log('🔧 Configurando webhook do MelhorEnvio...\n');

    // Passo 1: Obter token de acesso (você precisa ter autorizado o app antes)
    console.log('⚠️  ATENÇÃO: Você precisa ter autorizado o aplicativo pelo menos uma vez.');
    console.log('⚠️  Execute o fluxo de autorização OAuth2 primeiro.\n');

    // Para configurar webhook, você precisa de um access_token válido
    // Este script é apenas um exemplo - você precisará adaptar para seu caso

    const webhookUrl = `${process.env.FRONTEND_URL?.replace('femisse-front', 'feminisse-back')}/api/webhooks/melhorenvio`;
    
    console.log('📍 URL do Webhook:', webhookUrl);
    console.log('\n✅ Configure manualmente no painel:');
    console.log('   https://melhorenvio.com.br/painel/gerenciar/tokens\n');
    
    console.log('📋 Informações para configuração:');
    console.log('   - Aplicativo: Femisse (ID: 20450)');
    console.log('   - URL Webhook:', webhookUrl);
    console.log('   - Eventos: Todos os eventos de pedido (order.*)');
    console.log('\n✨ Após configurar, os webhooks serão enviados automaticamente!\n');

  } catch (error) {
    console.error('❌ Erro ao configurar webhook:', error.message);
    if (error.response) {
      console.error('Detalhes:', error.response.data);
    }
  }
}

setupWebhook();
