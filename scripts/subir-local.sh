#!/usr/bin/env bash
# Sobe o AtendeChat v5 na sua máquina: banco, Redis, migrations, empresa de demonstração,
# backend e frontend. Pode rodar quantas vezes quiser; o que já existe é reaproveitado.
#
#   ./scripts/subir-local.sh
#
# Ctrl+C encerra o backend e o frontend. O banco e o Redis continuam em segundo plano
# (pare com: docker compose -f docker-compose.local.yml down).
set -euo pipefail

cd "$(dirname "$0")/.."
RAIZ="$(pwd)"
BACK="$RAIZ/backend"
FRONT="$RAIZ/frontend"

azul() { printf "\n\033[1;34m%s\033[0m\n" "$1"; }
erro() { printf "\n\033[1;31m%s\033[0m\n" "$1" >&2; }

command -v node >/dev/null || { erro "Node.js não encontrado. Instale a versão 20 ou mais nova."; exit 1; }

# ---------- banco e redis ----------
if docker info >/dev/null 2>&1; then
  azul "Subindo Postgres e Redis"
  docker compose -f docker-compose.local.yml up -d
  printf "Esperando o banco responder"
  for _ in $(seq 1 60); do
    if docker compose -f docker-compose.local.yml exec -T postgres pg_isready -U salushchat -d salushchat >/dev/null 2>&1; then
      printf " pronto\n"; break
    fi
    printf "."; sleep 2
  done
else
  erro "Docker não está rodando. Suba um Postgres e um Redis você mesmo e ajuste o backend/.env."
  erro "Seguindo assim mesmo, com o que estiver no backend/.env."
fi

# ---------- .env ----------
if [ ! -f "$BACK/.env" ]; then
  azul "Criando backend/.env"
  SENHA_ADMIN="$(node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))")"
  cat > "$BACK/.env" <<EOF
NODE_ENV=development
BACKEND_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000
PROXY_PORT=8080
PORT=8080

DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=salushchat
DB_PASS=salushchat_local_dev
DB_NAME=salushchat
DB_POOL_MAX=10
DB_POOL_MIN=0

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

SEED_ADMIN_EMAIL=admin@local.test
SEED_ADMIN_PASSWORD=$SENHA_ADMIN

REDIS_URI=redis://:salushchat_redis_local@localhost:6379
REDIS_OPT_LIMITER_MAX=1
REDIS_OPT_LIMITER_DURATION=3000

USER_LIMIT=10
CONNECTIONS_LIMIT=10
BULL_BOARD=false

# Agente N1: sem a chave ele não responde, só transfere para a equipe.
# N1_ANTHROPIC_KEY=
EOF
fi

[ -f "$FRONT/.env" ] || { azul "Criando frontend/.env"; printf "REACT_APP_BACKEND_URL=http://localhost:8080\n" > "$FRONT/.env"; }

# ---------- dependências ----------
[ -d "$BACK/node_modules" ] || { azul "Instalando dependências do backend (demora alguns minutos)"; (cd "$BACK" && npm install --no-audit --no-fund); }
[ -d "$FRONT/node_modules" ] || { azul "Instalando dependências do frontend (demora alguns minutos)"; (cd "$FRONT" && npm install --no-audit --no-fund --legacy-peer-deps); }

# ---------- banco em dia ----------
azul "Aplicando migrations"
(cd "$BACK" && npx ts-node --transpile-only src/scripts/migrate.ts)

azul "Garantindo a empresa de demonstração"
(cd "$BACK" && npx ts-node --transpile-only src/scripts/seed-demo.ts)

# ---------- subir ----------
EMAIL="$(grep -E '^SEED_ADMIN_EMAIL=' "$BACK/.env" | cut -d= -f2-)"
SENHA="$(grep -E '^SEED_ADMIN_PASSWORD=' "$BACK/.env" | cut -d= -f2-)"

azul "Subindo backend e frontend"
(cd "$BACK" && npm run dev:server) & PID_BACK=$!
(cd "$FRONT" && BROWSER=none npm start) & PID_FRONT=$!
trap 'kill $PID_BACK $PID_FRONT 2>/dev/null || true' INT TERM EXIT

cat <<EOF

────────────────────────────────────────────────
  Sistema em http://localhost:3000
  Entre com   $EMAIL
  Senha       $SENHA

  Menu Agente N1 para configurar, Site e chat para
  o widget, Resultados para o que ele resolveu.
  O agente só responde depois de preencher
  N1_ANTHROPIC_KEY no backend/.env.
────────────────────────────────────────────────

EOF

wait $PID_BACK $PID_FRONT
