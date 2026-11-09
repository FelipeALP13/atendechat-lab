# Site e chat (v5)

Chat público para o site da empresa, atendido pelo Agente N1, com funil e contatos recebidos.

## Ativar
1. Rode a migration `20251125000002-create-site-module` (cria `SiteConfigs`, `SiteEvents`, `SiteLeads`).
2. Defina `BACKEND_URL` no servidor: é o endereço que entra na tag do site.
3. Menu **Site e chat** → ajuste aparência, contato, chat e textos → **Salvar e publicar**.
4. Aba **Instalação**: copie a tag e cole antes de `</body>` no site.

```html
<script src="https://api.suaempresa.com.br/site/SEU_TOKEN/widget.js" async></script>
```

## Como funciona
- Rascunho e versão publicada são separados: o visitante só vê o que foi publicado.
- O widget roda em Shadow DOM, então não briga com o CSS do site.
- Rotas públicas: `GET /site/:token/widget.js`, `GET /site/:token/config`, `POST /site/:token/chat`, `POST /site/:token/lead`. Montadas antes do CORS do painel, porque cada empresa libera os próprios endereços.
- Proteções: token por empresa, lista de sites permitidos, limite de 30 perguntas por sessão e 120 requisições por IP por hora, limite diário configurável e o limite de gasto do Agente N1.
- O limite por sessão e por IP é contado em memória, por processo: com várias instâncias do backend, vale por instância.
- Sem `N1_ANTHROPIC_KEY` o chat não inventa resposta: pede o contato do visitante.
- Fora do horário da equipe o chat continua respondendo e avisa quando ela volta.
- Gerar um token novo derruba a tag antiga na hora.

## Funil
Conta visitantes diferentes por etapa: abriram o chat, enviaram pergunta, foram resolvidos pelo assistente, precisaram de uma pessoa, deixaram contato. Recusa de dado sensível e "sou uma IA" não contam como resolvidas.

## Testes
`N1_TEST_DB=postgres://... npx jest src/services/SiteService` (31 passam).

## Resultados
O menu **Resultados** lê a auditoria do agente e os eventos do site: conversas atendidas, percentual resolvido sem a equipe, custo por conversa, série diária, canais, campanhas (utm_campaign) e as maiores lacunas. Rota `GET /results?days=`.
