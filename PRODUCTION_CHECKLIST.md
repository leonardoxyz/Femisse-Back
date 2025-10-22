# ✅ Checklist de Deploy para Produção - Feminisse E-commerce

## 🔒 SEGURANÇA - ANTES DO DEPLOY

### 1. Configurar Variáveis de Ambiente (.env)

```bash
# Copie o template
cp .env.production.example .env

# Preencha TODAS as variáveis obrigatórias:
```

**Variáveis CRÍTICAS** (aplicação não inicia sem elas em produção):
- ✅ `JWT_SECRET` (mínimo 32 caracteres)
- ✅ `TURNSTILE_SECRET_KEY` (Cloudflare Turnstile de produção)
- ✅ `SUPABASE_KEY` (Service Role Key)
- ✅ `MERCADOPAGO_ACCESS_TOKEN` (credenciais de PRODUÇÃO)
- ✅ `MERCADOPAGO_PUBLIC_KEY` (credenciais de PRODUÇÃO)
- ✅ `FRONTEND_URL` (domínio exato, sem wildcard)

### 2. Gerar JWT_SECRET Forte

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Configurar Cloudflare Turnstile

1. Acesse: https://dash.cloudflare.com/turnstile
2. Crie um novo site para **PRODUÇÃO**
3. Obtenha a **Secret Key** de produção
4. Adicione o domínio do frontend

### 4. Configurar Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers
2. Vá em **Credenciais → Produção**
3. Copie:
   - Access Token
   - Public Key
4. Configure Webhook:
   - URL: `https://seu-backend.com/api/webhooks/mercadopago`
   - Eventos: `payment`, `merchant_order`

### 5. Verificar CORS

O CORS está configurado para aceitar apenas domínios específicos.

Edite `src/config/environment.js` se necessário:
```javascript
const CORS_ORIGINS = [
  'https://seudominio.com.br',
  'https://www.seudominio.com.br'
];
```

---

## 🗄️ DATABASE

### Verificações no Supabase

```sql
-- 1. Verificar se products.images_urls está populado
SELECT id, name, images_urls 
FROM products 
WHERE images_urls IS NULL OR images_urls = '{}' 
LIMIT 10;

-- 2. Verificar índices
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'orders', 'users');

-- 3. Testar criação de pedido
-- (faça um pedido teste no frontend)
```

---

## ⚡ PERFORMANCE

### Redis Cache

- ✅ Configure `REDIS_URL` e `REDIS_PASSWORD`
- ✅ Verifique conexão: `redis-cli ping`

### Otimizações Ativas

- ✅ Cache de produtos (TTL: 2min)
- ✅ Cache de categorias (TTL: 5min)
- ✅ Cache de pedidos do usuário (TTL: 2min)
- ✅ Invalidação inteligente de cache

---

## 🧪 TESTES OBRIGATÓRIOS

Execute TODOS estes fluxos antes do deploy:

1. **Registro de usuário**
   - Com Cloudflare Turnstile
   - Validação de CPF
   - Email único

2. **Login**
   - Credenciais corretas
   - Token JWT gerado
   - Cookie httpOnly setado

3. **Criar endereço**
   - Busca CEP (ViaCEP)
   - Salvar endereço
   - Definir como padrão

4. **Adicionar produtos ao carrinho**
   - Produtos com variantes
   - Atualizar quantidades
   - Remover itens

5. **Aplicar cupom**
   - Código válido
   - Código inválido
   - Desconto aplicado corretamente

6. **Criar pedido**
   - Selecionar endereço
   - Calcular frete
   - Selecionar método de pagamento
   - **Verificar no banco**:
     - `order_number` gerado
     - `coupon_id` persistido (se aplicou cupom)
     - `payment_method` persistido
     - `total` correto

7. **Processar pagamento**
   - PIX: QR Code gerado
   - Cartão: validação de dados
   - Webhook do Mercado Pago funcionando

---

## 🚀 DEPLOY

### Plataformas Recomendadas

**Backend:**
- Vercel (Node.js)
- Railway
- Render
- AWS ECS

**Configurações no Vercel:**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Comandos de Deploy

```bash
# 1. Instalar dependências
npm ci --production

# 2. Build (se necessário)
npm run build

# 3. Testar localmente em modo produção
NODE_ENV=production npm start

# 4. Deploy
vercel --prod
```

---

## 📊 MONITORAMENTO PÓS-DEPLOY

### Primeiras 24 horas

Monitore:

1. **Logs de erro**
   ```bash
   # Vercel
   vercel logs --follow
   
   # Railway
   railway logs
   ```

2. **Métricas de performance**
   - Tempo de resposta das APIs
   - Taxa de erro
   - Uso de memória/CPU

3. **Transações**
   - Pedidos criados com sucesso
   - Pagamentos processados
   - Webhooks recebidos

4. **Segurança**
   - Tentativas de acesso bloqueadas
   - Rate limiting ativo
   - Turnstile funcionando

### Ferramentas Recomendadas

- **Logs**: Papertrail, Logtail, Sentry
- **Uptime**: UptimeRobot, Better Uptime
- **Performance**: New Relic, DataDog
- **Errors**: Sentry, Rollbar

---

## ⚠️ ROLLBACK

Se algo der errado:

```bash
# Vercel
vercel rollback

# Railway
railway rollback

# Manual
git revert HEAD
git push origin main
```

---

## 📞 SUPORTE

Em caso de problemas:

1. Verifique os logs primeiro
2. Confira as variáveis de ambiente
3. Teste as credenciais (MP, Supabase, etc.)
4. Valide a conectividade Redis
5. Verifique o status do Supabase

---

## ✅ CHECKLIST FINAL

Antes de marcar como DONE:

- [ ] Todas as variáveis de ambiente configuradas
- [ ] JWT_SECRET forte (64+ caracteres)
- [ ] Cloudflare Turnstile de produção configurado
- [ ] Mercado Pago de produção configurado
- [ ] Webhook do MP configurado e testado
- [ ] CORS com domínio exato (sem wildcard)
- [ ] Redis conectado
- [ ] Banco de dados populado corretamente
- [ ] Fluxo completo de compra testado end-to-end
- [ ] Cupom aplicado e persistido corretamente
- [ ] Logs de erro configurados
- [ ] Monitoramento ativo
- [ ] Backup do banco configurado

---

## 🎉 DEPLOY COMPLETO!

Após completar todos os itens acima, sua aplicação está pronta para produção com:

- ✅ Segurança enterprise-grade
- ✅ Performance otimizada
- ✅ Monitoramento ativo
- ✅ Backup e rollback preparados

**Boa sorte com seu e-commerce! 🚀**
