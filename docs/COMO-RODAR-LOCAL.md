# Rodar o AtendeChat v5 na sua máquina

```bash
git clone https://github.com/FelipeALP13/atendechat-lab.git
cd atendechat-lab
git checkout feat/agente-n1-v5
./scripts/subir-local.sh
```

O script faz tudo: sobe Postgres e Redis no Docker, cria os dois `.env` (com segredos aleatórios e
uma senha de administrador sorteada), instala as dependências, aplica as migrations, cria a empresa
de demonstração e sobe backend e frontend. No fim ele imprime o endereço e as credenciais.

Pode rodar de novo quantas vezes quiser: o que já existe é reaproveitado. `Ctrl+C` encerra backend
e frontend; o banco e o Redis seguem em segundo plano (`docker compose -f docker-compose.local.yml down`
para parar).

Sem Docker, suba um Postgres e um Redis você mesmo e ajuste `backend/.env` antes de rodar o script.

## O que olhar depois de entrar
- **Agente N1** — configuração, lacunas, respostas aprovadas, auditoria e consumo.
- **Site e chat** — aparência, textos, funil, contatos recebidos e a tag para instalar no site.
- **Resultados** — conversas atendidas, resolvidas sem a equipe e custo por conversa.
- **Conexões** — editar uma conexão e ligar o **Agente N1** nela.

O agente só responde depois de `N1_ANTHROPIC_KEY` no `backend/.env` e do GitBook sincronizado.
Sem a chave ele não inventa resposta: avisa o cliente e transfere para a equipe.

## Comandos soltos
```bash
cd backend
npm run db:status      # o que falta aplicar
npm run db:migrate:ts  # aplica as migrations (as deste projeto são .ts; o sequelize-cli não as enxerga)
npm run seed:demo      # cria empresa e administrador (SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD)
```
