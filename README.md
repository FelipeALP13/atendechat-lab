# AtendeChat

Plataforma SaaS multi-tenant de atendimento ao cliente via WhatsApp, Facebook, Instagram e chat interno. Backend em Node.js/TypeScript, frontend em React, API Oficial WhatsApp em NestJS.

## Stack

| Camada | Tecnologia | Detalhe |
|--------|-----------|---------|
| Backend | Node.js 20 + TypeScript + Express | Sequelize ORM, Socket.IO, Bull queues |
| Frontend | React 18 + Material-UI 5 | CRA, Axios, Socket.IO Client |
| API Oficial | NestJS 10 + Prisma 5 | Integração com Meta WhatsApp Business API |
| Banco | PostgreSQL 15+ | 329 migrations, 66 models |
| Cache/Fila | Redis 7 | Via Docker, BullMQ para jobs |
| Infra | Nginx + PM2 + Certbot | Proxy reverso, SSL automático |

## Estrutura do Repositório

```
├── backend/                     ← API principal (Express + Sequelize)
│   ├── src/
│   │   ├── controllers/         ← 47 rotas
│   │   ├── models/              ← 66 modelos Sequelize
│   │   ├── services/            ← Lógica de negócio
│   │   │   ├── WbotServices/    ← WhatsApp via Baileys
│   │   │   ├── WhatsAppOficial/ ← WhatsApp via API Meta
│   │   │   ├── WebhookService/  ← FlowBuilder e webhooks
│   │   │   ├── MessageServices/ ← Mensagens (envio, transcrição)
│   │   │   └── ...
│   │   ├── routes/              ← Definição das rotas REST
│   │   ├── database/migrations/ ← 329 migrations
│   │   ├── libs/                ← Baileys, WhatsApp Oficial
│   │   ├── middleware/          ← Auth, rate limiting
│   │   ├── queues/              ← Bull jobs (mensagens, campanhas)
│   │   └── helpers/             ← Utilitários
│   ├── .env.example
│   └── package.json             ← v4.10.8
│
├── frontend/                    ← Painel React
│   ├── src/
│   │   ├── components/          ← Componentes reutilizáveis
│   │   ├── pages/               ← Páginas (Dashboard, Tickets, FlowBuilder...)
│   │   ├── context/             ← Auth, Socket, WhatsApp contexts
│   │   ├── hooks/               ← Custom hooks
│   │   ├── services/            ← Chamadas à API (Axios)
│   │   └── translate/           ← i18n
│   ├── .env.example
│   └── package.json
│
└── api_oficial/                 ← API WhatsApp Business (NestJS)
    ├── src/
    │   ├── @core/
    │   │   ├── infra/           ← Database (Prisma), Redis, Meta integration
    │   │   ├── guard/           ← Token authentication
    │   │   └── domain/          ← Business entities
    │   └── resources/v1/        ← Endpoints (webhook, send-message, templates)
    ├── prisma/schema.prisma
    └── package.json
```

## Funcionalidades

**Canais:** WhatsApp (Baileys), WhatsApp Business API (Meta), Facebook Messenger, Instagram Direct, Chat Interno.

**Atendimento:** Filas com distribuição automática, tickets com Kanban, notas internas, transferência entre atendentes, histórico completo, horário de funcionamento por fila.

**Automação:** FlowBuilder visual (chatbots), menus interativos, respostas rápidas, agendamento de mensagens, campanhas em massa com recorrência, webhooks de entrada/saída.

**Integrações:** OpenAI (ChatGPT/Gemini), API Externa (envio/recebimento programático), webhooks customizáveis, N8N.

**Gestão:** Dashboard com métricas em tempo real, multi-empresa (SaaS), controle granular de permissões por usuário, planos com limites configuráveis.

**Pagamentos:** Stripe, Mercado Pago, Asaas, EFÍ/Gerencianet (PIX/boleto).

## Configuração

### Backend (.env)

```env
NODE_ENV=
BACKEND_URL=https://api.seudominio.com
FRONTEND_URL=https://app.seudominio.com
PORT=4001

DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=nome_instancia
DB_PASS=senha_segura
DB_NAME=nome_instancia

JWT_SECRET=<gerar com: openssl rand -base64 32>
JWT_REFRESH_SECRET=<gerar com: openssl rand -base64 32>

REDIS_URI=redis://:senha@127.0.0.1:5001

# WhatsApp API Oficial (opcional)
USE_WHATSAPP_OFICIAL=true
URL_API_OFICIAL=https://apioficial.seudominio.com
TOKEN_API_OFICIAL=seu_token

# Pagamento (configurar conforme gateway)
GERENCIANET_SANDBOX=false
GERENCIANET_CLIENT_ID=
GERENCIANET_CLIENT_SECRET=
GERENCIANET_PIX_CERT=
GERENCIANET_PIX_KEY=
```

### Frontend (.env)

```env
REACT_APP_BACKEND_URL=https://api.seudominio.com
REACT_APP_NAME_SYSTEM=AtendeChat
REACT_APP_NUMBER_SUPPORT=5500000000000
```

### API Oficial (.env)

```env
PORT=6001
API_URL=https://apioficial.seudominio.com
DATABASE_LINK=postgresql://user:pass@localhost:5432/dbname
TOKEN_ADMIN=token_seguro
URL_BACKEND_MULT100=https://api.seudominio.com
REDIS_URI=redis://:senha@127.0.0.1:5001
```

## Instalação

Use o [instalador automatizado](https://github.com/Atendechat08/instalador-Atendechat) para deploy em produção. Ele configura tudo: banco, Redis, Nginx, SSL, PM2.

### Deploy Manual

```bash
# Backend
cd backend
cp .env.example .env   # editar com seus dados
npm install
npm run build
npx sequelize db:migrate
npx sequelize db:seed:all
pm2 start dist/server.js --name app-backend

# Frontend
cd frontend
cp .env.example .env   # editar REACT_APP_BACKEND_URL
npm install
GENERATE_SOURCEMAP=false npm run build
# Criar server.js para servir o build (ver instalador)
pm2 start server.js --name app-frontend

# API Oficial (opcional)
cd api_oficial
cp .env.example .env   # editar
npm install
npx prisma migrate deploy
npm run build
pm2 start dist/main.js --name app-api-oficial
```

## Comandos

```bash
# Build
cd backend && npm run build        # Compila TypeScript
cd frontend && npm run build       # Build React

# Banco
cd backend && npm run db:migrate   # Rodar migrations
cd backend && npm run db:seed      # Rodar seeds

# Dev
cd backend && npm run dev:server   # Backend com hot reload
cd frontend && npm start           # Frontend dev server

# Testes
cd backend && npm test
```

## Segurança

- JWT secrets devem ser únicos por instância (gerar com `openssl rand -base64 32`)
- Trocar credenciais padrão (`atendechat123@gmail.com` / `chatbot123`) no primeiro acesso
- Redis deve ter senha (`requirepass` no container)
- Configurar UFW: `sudo ufw allow 22,80,443/tcp && sudo ufw enable`
- `.env` está no `.gitignore` — nunca commitar credenciais

## Licença

Software proprietário. Todos os direitos reservados.

---

**Versão:** 4.10.8 | **Atualizado:** Março 2026
