/**
 * Páginas de TESTE, escritas a partir dos resumos da leitura da documentação SGE.
 * Não são o texto oficial do GitBook: servem para testar busca, decisão e transferência sem rede.
 */
export const PAGES: Record<string, { title: string; body: string }> = {
  "financeiro-fi/banco/unificar-boleto": {
    title: "Unificar Boleto",
    body: `# Unificar Boleto
Une dois ou mais boletos do mesmo associado em um só. Os boletos precisam vencer no mesmo mês e ser de contratos diferentes.

## Como unificar
1. Em Administrativo > Manutenção > Associado > Informações Adicionais, ative o campo Boleto Unificado.
2. Acesse Financeiro > Banco > Unificar Boleto.
3. Preencha os filtros e clique em Pesquisar.
4. Marque os lançamentos e clique em Confirmar Unificação.`,
  },
  "financeiro-fi/banco/desunificar-boleto": {
    title: "Desunificar Boleto",
    body: `# Desunificar Boleto
Desfaz a unificação de boletos já unificados, devolvendo os lançamentos à forma separada. Usa os mesmos filtros da tela Unificar Boleto.

## Passos
1. Preencha os filtros e clique em Pesquisar.
2. Selecione os lançamentos unificados.
3. Clique em Confirmar Desunificação.
4. Valide em Unificar Boleto, pesquisando o período.`,
  },
  "financeiro-fi/cobranca/rn-suspencao-e-inativacao": {
    title: "RN Suspensão e Inativação",
    body: `# RN Suspensão e Inativação
Bloqueia ou inativa em lote os contratos com pendência financeira. A execução é agendada.

## Bloquear contratos inadimplentes
1. Filtre os contratos e selecione os que serão bloqueados.
2. Clique em Efetuar Bloqueio.
3. Em Alterar Status, escolha o status, o tipo de ticket e a mensagem. Clique em Continuar.
4. Confira o Resumo e clique em Agendar Horário.
5. Clique em Executar.

## Cancelar um bloqueio agendado
Enquanto o Status mostrar Cancelar, o bloqueio ainda não rodou. Clique em Cancelar e confirme com Sim.`,
  },
  "administrativo/manutencao/associado": {
    title: "Associado",
    body: `# Associado
Tela de consulta e manutenção dos associados.

## Filtros
Status, Situação (com ou sem proposta), Tipo de Associado (pessoa física ou jurídica), Pesquisar por, Texto e Forma de Envio de Boleto.

## Endereço
A seção Endereço de Correspondência recebe o endereço para onde vai o boleto, que pode ser diferente do residencial.`,
  },
  "configuracao/mensagem/whatsapp": {
    title: "WhatsApp",
    body: `# WhatsApp
Modelos de mensagem de WhatsApp usados nas rotinas do SGE. O modelo aceita até 1.000 caracteres.

## Variáveis
Use variáveis entre colchetes, como [NOME_ESTIPULANTE], para preencher dados do cliente automaticamente. A lista completa está no botão Legendas.`,
  },
  "financeiro-fi/servico/alteracao-vencimento": {
    title: "Alteração de Vencimento",
    body: `# Alteração de Vencimento
Altera o dia de vencimento fixo de uma proposta. Vale somente para propostas com vencimento fixo.

## Passos
1. Pesquise o associado.
2. Selecione a proposta.
3. Clique em Fazer Alteração de Vencimento.
4. Informe o novo dia e confirme.`,
  },
  "financeiro-fi/boleto-de-servico/coparticipacao": {
    title: "Importar Coparticipação",
    body: `# Importar Coparticipação
Importa arquivos de coparticipação de um convênio e competência.

## Passos
1. Escolha o Convênio e informe a Competência.
2. Baixe o layout e o arquivo de exemplo.
3. Preencha o arquivo e clique em Processar.

O valor é somado ao lançamento de mesma referência. Se esse lançamento já estiver faturado, é criado um lançamento avulso.`,
  },
  "seguranca/alterar-senha": {
    title: "Alterar Senha",
    body: `# Alterar Senha
Atualiza a senha do usuário logado.

## Passos
Informe a senha antiga, digite a nova senha, confirme e clique em Alterar Senha. A senha antiga precisa estar correta e a nova e a confirmação precisam ser iguais.`,
  },
  "financeiro-fi/log-auditoria": {
    title: "Log Auditoria",
    body: `# Log Auditoria
Mostra o histórico de alterações de um lançamento financeiro.

## Como consultar
Acesse Financeiro > Log Auditoria, filtre por Número, Número do Documento ou Conteúdo Antigo e Novo. A tela exibe o campo alterado, o conteúdo antigo e novo, o usuário, a data e a hora.`,
  },
  "financeiro-fi/tesouraria/competencia/abertura": {
    title: "Abertura de Competência",
    body: `# Abertura de Competência
Reabre lançamentos fechados para permitir alteração.

## Passos
Consulte com os filtros de período de pagamento, chave e tipo de parcela, selecione os registros e clique em Confirmar Abertura. O cadeado some e o lançamento fica editável.`,
  },
  "ferramenta/gerenciador-de-whatsapp": {
    title: "Gerenciador de WhatsApp",
    body: `# Gerenciador de WhatsApp
Consulta, acompanha e envia mensagens individuais de WhatsApp.

## Enviar
Clique em Novo, defina a mensagem, informe o destinatário e clique no botão roxo. Exige a API de WhatsApp configurada na tela Empresa.`,
  },
  "configuracao/geral/cpf-contratante": {
    title: "CPF Contratante",
    body: `# CPF Contratante
Bloqueia CPFs ou CNPJs para novas contratações.

## Passos
Clique em Incluir, preencha o CPF ou CNPJ e a observação e clique em Gravar.`,
  },
  "financeiro-fi/servico/dmed": {
    title: "DMED",
    body: `# DMED
Gera o arquivo da DMED, em TXT ou CSV, para envio à Receita Federal.

## Passos
Preencha os campos obrigatórios, clique em Pesquisar, confira os dados e exporte. Ano Referência é o ano dos recebimentos. Clínicas e laboratórios usam TOP e DTOP; operadoras usam RPPSS e BRPPSS.`,
  },
};
