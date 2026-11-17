// Ponta a ponta do agente N1 no banco LOCAL, com Claude, Portal e API oficial do WhatsApp SIMULADOS.
// Nada sai desta máquina: não gasta créditos e não manda mensagem para ninguém. Apaga o que criar.
// Não roda se já existir um agente N1 na empresa 1 (para não mexer em configuração real).
//
// Uso (depois de `npx tsc -p .` e das migrações), de dentro de backend/:
//   node scripts/e2e-n1.js
require("dotenv").config();
const http = require("http");

const MOCK_PORT = 7070;
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
process.env.ANTHROPIC_BASE_URL = MOCK;
process.env.URL_API_OFICIAL = MOCK;
process.env.USE_WHATSAPP_OFICIAL = "true";
process.env.TOKEN_API_OFICIAL = "token-falso-local";
process.env.FRONTEND_URL = "http://localhost:3000";

const PORTAL_KEY = "pk_ac_chaveDeTesteFalsaSomenteLocal123456";
const seen = { claude: [], portalSearch: [], portalTickets: [], sent: [], claudeHeaders: [] };

// ---------- servidor falso ----------
function claudeReply(body) {
  const last = body.messages[body.messages.length - 1];
  const content = Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }];
  const toolResult = content.find(block => block.type === "tool_result");
  const userText = content.filter(b => b.type === "text").map(b => b.text).join(" ").toLowerCase();
  const msg = (blocks, stop) => ({ id: `msg_${Date.now()}`, type: "message", role: "assistant", model: body.model, content: blocks, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 60, cache_read_input_tokens: 900 } });
  if (toolResult) {
    const asked = body.messages[body.messages.length - 2].content.find(b => b.type === "tool_use");
    if (asked.name === "buscar_base_conhecimento") return msg([{ type: "text", text: "Mariana, é só acessar Financeiro > Boletos e clicar em Segunda via. O PDF chega no seu e-mail." }], "end_turn");
    return msg([{ type: "text", text: "Entendi. Vou passar para um atendente, que já vai ver nossa conversa." }], "end_turn");
  }
  if (userText.includes("boleto")) return msg([{ type: "text", text: "Vou verificar." }, { type: "tool_use", id: "toolu_1", name: "buscar_base_conhecimento", input: { consulta: "segunda via boleto" } }], "tool_use");
  if (userText.includes("cobrad")) return msg([{ type: "tool_use", id: "toolu_2", name: "transferir_para_atendente", input: { motivo: "Cobrança em duplicidade", resumo: "Cliente diz que foi cobrada duas vezes no boleto de novembro.", urgencia: "high" } }], "tool_use");
  return msg([{ type: "text", text: "Pode me contar mais?" }], "end_turn");
}

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", chunk => (raw += chunk));
  req.on("end", () => {
    const send = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (req.method === "POST" && req.url.startsWith("/v1/messages")) {
      const body = JSON.parse(raw);
      seen.claude.push(body);
      seen.claudeHeaders.push({ beta: req.headers["anthropic-beta"], key: req.headers["x-api-key"], auth: req.headers.authorization, names: Object.keys(req.headers).join(",") });
      return send(200, claudeReply(body));
    }
    if (req.url.startsWith("/api/integrations/atendechat")) {
      if (req.headers.authorization !== `Bearer ${PORTAL_KEY}`) return send(401, { error: "chave" });
      if (req.method === "GET") { seen.portalSearch.push(decodeURIComponent(req.url.split("q=")[1] || "")); return send(200, { articles: [{ id: 1, title: "Segunda via do boleto", body: "Financeiro > Boletos > Segunda via.", tags: "n1", updatedAt: "" }] }); }
      seen.portalTickets.push(JSON.parse(raw));
      return send(201, { ticket: { id: 99, code: "CH-99" } });
    }
    if (req.method === "POST" && req.url.startsWith("/v1/send-message-whatsapp/")) {
      const data = /name="data"\r\n\r\n([\s\S]*?)\r\n--/.exec(raw);
      seen.sent.push(data ? JSON.parse(data[1]) : raw);
      return send(200, { idMessageWhatsApp: [`wamid.fake.${seen.sent.length}`] });
    }
    if (req.method === "GET" && req.url === "/") return send(200, "API ONLINE (falsa)");
    send(404, { error: "rota falsa não existe" });
  });
});

const results = [];
const check = (label, ok, extra = "") => { results.push(ok); console.log(`${ok ? "ok  " : "FALHOU"}  ${label}${extra ? ` · ${extra}` : ""}`); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  await new Promise(resolve => server.listen(MOCK_PORT, "127.0.0.1", resolve));
  require("../dist/libs/socket").initIO(http.createServer());
  const sequelize = require("../dist/database").default;
  const Queue = require("../dist/models/Queue").default;
  const Whatsapp = require("../dist/models/Whatsapp").default;
  const N1Agent = require("../dist/models/N1Agent").default;
  const Ticket = require("../dist/models/Ticket").default;
  const Message = require("../dist/models/Message").default;
  const Contact = require("../dist/models/Contact").default;
  const { ReceibedWhatsAppService } = require("../dist/services/WhatsAppOficial/ReceivedWhatsApp");
  const made = { queue: null, whatsapp: null, agent: null, numbers: ["5511900000001", "5511900000002"] };

  const incoming = (number, text, id) => new ReceibedWhatsAppService().getMessage({
    token: "teste-n1-token", fromNumber: number, nameContact: number.endsWith("1") ? "Mariana Teste" : "João Teste",
    message: { type: "text", text, idMessage: id, timestamp: Math.floor(Date.now() / 1000) }
  });
  const ticketOf = async number => { const contact = await Contact.findOne({ where: { number, companyId: 1 } }); return contact ? Ticket.findOne({ where: { contactId: contact.id }, order: [["id", "DESC"]] }) : null; };
  const messagesOf = ticket => Message.findAll({ where: { ticketId: ticket.id }, order: [["id", "ASC"]] });

  // O N1 é um por empresa: se já existe um (real), o teste não roda para não mexer nele.
  if (await N1Agent.findOne({ where: { companyId: 1 } })) {
    console.log("FALHOU  já existe um agente N1 na empresa 1; o teste não roda para não alterá-lo");
    process.exit(1);
  }
  try {
    made.queue = await Queue.create({ name: "TESTE-N1 Suporte N2", color: "#123456", companyId: 1, ativarRoteador: false, tempoRoteador: 0 });
    made.whatsapp = await Whatsapp.create({ name: "TESTE-N1 oficial", channel: "whatsapp_oficial", token: "teste-n1-token", status: "CONNECTED", companyId: 1, isDefault: false });
    made.agent = await N1Agent.create({ companyId: 1, name: "Ana", enabled: true, whatsappIds: [made.whatsapp.id], handoffQueueId: made.queue.id, instructions: "Somos a Loja Teste.", apiKey: "sk-ant-teste-falsa-local", model: "claude-opus-5-5", effort: "low", maxTurns: 8, portalUrl: MOCK, portalKey: PORTAL_KEY });
    const stored = await sequelize.query(`select "apiKey", "portalKey" from "N1Agents" where id = ${made.agent.id}`, { plain: true });
    check("chaves do N1 gravadas criptografadas", stored.apiKey.startsWith("enc:v1:") && stored.portalKey.startsWith("enc:v1:"));

    // 1) Pergunta que está na base
    await incoming(made.numbers[0], "Oi, como tiro a segunda via do boleto?", "wamid.in.1");
    await wait(5000);
    let ticket = await ticketOf(made.numbers[0]);
    let msgs = await messagesOf(ticket);
    const reply = msgs.find(m => m.fromMe && !m.isPrivate);
    const note = msgs.find(m => m.isPrivate);
    check("N1 respondeu o cliente pelo WhatsApp oficial", seen.sent.length === 1 && String(seen.sent[0].body_text?.body || "").includes("Financeiro > Boletos"), JSON.stringify(seen.sent[0]).slice(0, 120));
    check("resposta salva na conversa (com marca de bot)", reply && reply.body.startsWith("‎") && reply.body.includes("Segunda via"));
    check("buscou no Portal com a chave", seen.portalSearch[0] === "segunda via boleto");
    check("nota privada para a equipe", note && note.body.includes("Buscou na base") && note.body.includes("claude-opus-5-5"), note && note.body.split("\n").slice(0, 2).join(" | "));
    check("ticket marcado como N1 ativo, 1 resposta", ticket.n1Status === "active" && ticket.n1Turns === 1 && ticket.status === "pending" && !ticket.userId);
    const first = seen.claude[0];
    check("pedido ao Claude: modelo, esforço, troca automática e cache", first.model === "claude-opus-5-5" && first.output_config.effort === "low" && first.fallbacks === "default" && String(seen.claudeHeaders[0].beta).includes("server-side-fallback-2026-07-01") && first.system[0].cache_control?.type === "ephemeral");
    // O SDK 1.x manda a chave em "Authorization: Bearer".
    check("chave da Anthropic aberta só na hora de usar", seen.claudeHeaders[0].auth === "Bearer sk-ant-teste-falsa-local");
    check("conversa enviada ao Claude sem a nota privada", first.messages.length === 1 && first.messages[0].content.includes("segunda via"));

    // 2) Assunto que precisa da equipe
    await incoming(made.numbers[0], "Mas eu fui cobrada duas vezes!", "wamid.in.2");
    await wait(5000);
    ticket = await ticketOf(made.numbers[0]);
    msgs = await messagesOf(ticket);
    const second = seen.claude[2];
    check("histórico com a resposta anterior do N1", second && second.messages.some(m => m.role === "assistant" && String(m.content).includes("Financeiro > Boletos")), JSON.stringify(second && second.messages.map(m => [m.role, String(typeof m.content === "string" ? m.content : "[blocos]").slice(0, 40)])));
    check("N1 transferiu para a fila do N2", ticket.n1Status === "handed_off" && ticket.queueId === made.queue.id && ticket.status === "pending" && ticket.isBot === false, `fila ${ticket.queueId}, status ${ticket.status}`);
    const handoffNote = msgs.filter(m => m.isPrivate).pop();
    check("nota com resumo e urgência", handoffNote.body.includes("urgência alta") && handoffNote.body.includes("cobrada duas vezes"));
    check("cliente avisado da transferência", String(seen.sent[1]?.body_text?.body || "").includes("atendente"));

    // 3) Depois de transferir, o N1 não responde mais
    const callsBefore = seen.claude.length;
    await incoming(made.numbers[0], "alguém aí?", "wamid.in.3");
    await wait(4000);
    check("N1 fica quieto depois de passar para a equipe", seen.claude.length === callsBefore && seen.sent.length === 2);

    // 4) Pedido de pessoa: transfere sem chamar o Claude
    const before4 = seen.claude.length;
    await incoming(made.numbers[1], "quero falar com um atendente humano", "wamid.in.4");
    await wait(5000);
    const ticket2 = await ticketOf(made.numbers[1]);
    check("pedido de atendente: transfere sem gastar o Claude", seen.claude.length === before4 && ticket2.n1Status === "handed_off" && ticket2.queueId === made.queue.id);

    // 5) A tela recebe o ticket sem segredos
    const json = JSON.stringify((await Ticket.findByPk(ticket.id)).toJSON());
    check("ticket na tela tem n1Status e nenhuma chave", json.includes('"n1Status":"handed_off"') && !json.includes("sk-ant") && !json.includes(PORTAL_KEY));
  } catch (error) {
    check("erro inesperado", false, error.stack);
  } finally {
    // Limpeza
    for (const number of made.numbers) {
      const contact = await Contact.findOne({ where: { number, companyId: 1 } });
      if (!contact) continue;
      const tickets = await Ticket.findAll({ where: { contactId: contact.id } });
      for (const t of tickets) {
        await sequelize.query(`delete from "Messages" where "ticketId" = ${t.id}`);
        await sequelize.query(`delete from "TicketTraking" where "ticketId" = ${t.id}`).catch(() => undefined);
        await sequelize.query(`delete from "LogTickets" where "ticketId" = ${t.id}`).catch(() => undefined);
        await t.destroy();
      }
      await sequelize.query(`delete from "Messages" where "contactId" = ${contact.id}`);
      await contact.destroy();
    }
    if (made.agent) await made.agent.destroy();
    if (made.whatsapp) await made.whatsapp.destroy();
    if (made.queue) await made.queue.destroy();
    const left = await sequelize.query(`select (select count(*) from "Tickets") t, (select count(*) from "Contacts") c, (select count(*) from "Messages") m, (select count(*) from "N1Agents") a, (select count(*) from "Whatsapps") w, (select count(*) from "Queues") q`, { plain: true });
    console.log(`limpeza: tickets ${left.t}, contatos ${left.c}, mensagens ${left.m}, agentes ${left.a}, conexões ${left.w}, filas ${left.q}`);
    console.log(`${results.filter(Boolean).length}/${results.length} ok`);
    server.close();
    process.exit(0);
  }
})();
