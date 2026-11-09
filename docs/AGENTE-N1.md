# Agente N1 (v5)

Responde sozinho o suporte nível 1 e transfere para a equipe (N2) quando não sabe.

## Ativar
1. Rode as migrations (`20251125000001-create-agent-n1`): cria N1Pages, N1Chunks, N1Proposals, N1Approved, N1Audit, N1Usage, N1Settings e a coluna `Whatsapps.n1Enabled`. Requer Postgres.
2. No servidor defina `N1_ANTHROPIC_KEY` (ou `ANTHROPIC_API_KEY`). Opcionais: `N1_MODEL` (padrão claude-sonnet-5-5), `N1_PRICE_IN` / `N1_PRICE_OUT` (US$/MTok, são estimativas: confira os preços reais).
3. Menu **Agente N1** → Configuração: informe o GitBook e clique em *Sincronizar agora*.
4. Conexões → editar → ligue **Agente N1** (substitui o OpenAI naquela conexão).

## Fluxo
Mensagem nova em ticket sem fila/atendente → regras de segurança → busca na base → responde (≥ limite), prepara rascunho (entre limites) ou transfere com nota interna. Lacunas viram propostas; o N2 responde, o admin aprova, e a resposta passa a valer (dados pessoais removidos).

## Testes
`N1_TEST_DB=postgres://... npx jest src/services/AgentN1` (38 passam; 4 casos dependem do modelo real).

## Onde o agente aparece no painel
- **Agente N1** — configuração, lacunas e propostas, respostas aprovadas, auditoria e consumo.
- **Site e chat** — o mesmo agente atendendo no site da empresa.
- **Resultados** — quanto ele resolveu sozinho e quanto custou.
- Na conversa, o menu de uma mensagem enviada pela equipe tem **Salvar como conhecimento**.
