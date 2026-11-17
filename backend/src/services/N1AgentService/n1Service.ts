import { randomUUID } from "crypto";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import N1Agent from "../../models/N1Agent";
import Ticket from "../../models/Ticket";
import { decryptSecret } from "../../helpers/secretBox";
import logger from "../../utils/logger";
import CreateMessageService from "../MessageServices/CreateMessageService";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { getWbot } from "../../libs/wbot";
import { getJidOf } from "../WbotServices/getJidOf";
import { AI_FAILURE_MESSAGE, anthropicClient, asksForHuman, customerFirstName, recentTextMessages } from "../IntegrationsServices/aiShared";
import { createPortalClient, normalizePortalUrl } from "./portalClient";
import { CreateMessage, N1Config, N1Effort, N1_EFFORTS, noteFor, runN1Turn } from "./n1Core";

/**
 * Liga o agente N1 às conversas: decide se ele atende, chama o núcleo (n1Core), manda a resposta
 * pelo canal certo (WhatsApp normal ou oficial), registra uma nota privada para a equipe e,
 * quando é o caso, passa o atendimento para a fila do N2.
 */

/** Espera antes de responder: se o cliente mandar outra mensagem logo em seguida, responde só a última. */
const DEBOUNCE_MS = 2500;
const HISTORY_LIMIT = 30;
const HANDOFF_MESSAGE = "Vou passar sua conversa para um atendente da nossa equipe. Ele já vai ver o que conversamos, é só aguardar um pouquinho.";
const NON_TEXT_MESSAGE = "Por enquanto eu só consigo ler mensagens de texto. Vou passar para um atendente da equipe, que vai continuar com você.";

/** Mensagens do bot começam com este caractere invisível: o listener do WhatsApp não as trata como resposta humana. */
const BOT_MARK = "‎";

const running = new Set<number>();

export async function agentFor(companyId: number, whatsappId: number | null): Promise<N1Agent | null> {
  if (!whatsappId) return null;
  const agent = await N1Agent.findOne({ where: { companyId, enabled: true } });
  if (!agent || !agent.apiKey) return null;
  const ids = Array.isArray(agent.whatsappIds) ? agent.whatsappIds.map(Number) : [];
  return ids.includes(Number(whatsappId)) ? agent : null;
}

/** O N1 pode responder este atendimento? (ninguém da equipe assumiu e ele ainda não passou adiante) */
export function n1CanHandle(ticket: Ticket): boolean {
  if (ticket.isGroup || ticket.imported) return false;
  if (ticket.userId || ticket.status === "open" || ticket.status === "closed" || ticket.status === "nps") return false;
  if (ticket.n1Status === "handed_off") return false;
  return true;
}

export function configOf(agent: N1Agent): N1Config {
  return {
    name: agent.name || "Assistente",
    instructions: agent.instructions || "",
    model: agent.model || "claude-opus-5-5",
    effort: (N1_EFFORTS as readonly string[]).includes(agent.effort) ? (agent.effort as N1Effort) : "medium",
    portalEnabled: Boolean(normalizePortalUrl(agent.portalUrl) && agent.portalKey)
  };
}

export function claudeFor(agent: N1Agent): CreateMessage {
  const client = anthropicClient(agent.apiKey as string);
  return params => client.beta.messages.create(params);
}

export function toolsFor(agent: N1Agent, ticket: Ticket, contact: Contact) {
  const url = normalizePortalUrl(agent.portalUrl);
  const portal = url && agent.portalKey ? createPortalClient(url, decryptSecret(agent.portalKey)) : null;
  const frontend = (process.env.FRONTEND_URL || "").replace(/\/+$/, "");
  return {
    async searchKnowledge(query: string) {
      if (!portal) return [];
      return portal.searchKnowledge(query);
    },
    async openTicket(input: { title: string; description: string; urgency: "low" | "normal" | "high" | "critical" }) {
      if (!portal) throw new Error("Portal não configurado");
      return portal.createTicket({
        ...input,
        externalId: String(ticket.id),
        customerName: contact.name,
        customerPhone: contact.number,
        conversationUrl: frontend ? `${frontend}/tickets/${ticket.uuid || ticket.id}` : null
      });
    }
  };
}

/** Manda texto ao cliente pelo canal do atendimento e salva na conversa. */
async function sendToCustomer(ticket: Ticket, contact: Contact, text: string): Promise<void> {
  const body = `${BOT_MARK}${text}`;
  if (ticket.channel === "whatsapp_oficial") {
    await SendWhatsAppOficialMessage({ body, ticket, quotedMsg: null, type: "text", media: null, vCard: null });
    return;
  }
  const wbot = await getWbot(ticket.whatsappId);
  const sent = await wbot.sendMessage(getJidOf(contact), { text: body });
  // Import tardio: o listener também importa este arquivo.
  const { verifyMessage } = await import("../WbotServices/wbotMessageListener");
  await verifyMessage(sent, ticket, contact);
}

/** Nota que só a equipe vê, na linha do tempo da conversa. */
export async function addPrivateNote(ticket: Ticket, text: string): Promise<void> {
  try {
    await CreateMessageService({
      companyId: ticket.companyId,
      messageData: {
        wid: `PVT-N1-${randomUUID()}`,
        ticketId: ticket.id,
        body: text.slice(0, 4000),
        fromMe: true,
        read: true,
        mediaType: "extendedTextMessage",
        ack: 2,
        isPrivate: true
      }
    });
  } catch (error) {
    logger.error(`[N1] Não foi possível registrar a nota do ticket ${ticket.id}:`, error);
  }
}

/** Passa o atendimento para a equipe (fila do N2), sem o N1 voltar a responder nele. */
export async function handOff(ticket: Ticket, contact: Contact, agent: N1Agent): Promise<void> {
  await ticket.update({ n1Status: "handed_off", isBot: false, useIntegration: false, status: "pending" });
  try {
    if (agent.handoffQueueId) {
      const { transferQueue } = await import("../WbotServices/wbotMessageListener");
      await transferQueue(agent.handoffQueueId, ticket, contact);
    } else {
      await UpdateTicketService({ ticketData: { status: "pending", isBot: false }, ticketId: ticket.id, companyId: ticket.companyId });
    }
  } catch (error) {
    logger.error(`[N1] Falha ao mover o ticket ${ticket.id} para a fila:`, error);
  }
}

/** Última mensagem do cliente neste atendimento (para saber se chegou outra durante a espera). */
async function latestCustomerMessageId(ticketId: number): Promise<number | null> {
  const last = await Message.findOne({ where: { ticketId, fromMe: false, isPrivate: { [Op.not]: true } }, order: [["createdAt", "DESC"], ["id", "DESC"]], attributes: ["id"] });
  return last ? last.id : null;
}

/**
 * Chamado pelos listeners (WhatsApp normal e oficial) quando chega mensagem do cliente.
 * Devolve true se o N1 cuidou da mensagem (o listener não deve seguir com menus/robôs).
 */
export async function handleN1Message(args: { ticket: Ticket; contact: Contact; text: string }): Promise<boolean> {
  const { ticket, contact } = args;
  if (!n1CanHandle(ticket)) return false;
  if (contact.disableBot) return false;
  const agent = await agentFor(ticket.companyId, ticket.whatsappId);
  if (!agent) return false;

  if (ticket.n1Status !== "active") await ticket.update({ n1Status: "active", isBot: true });
  // A resposta roda em segundo plano: o listener do WhatsApp segue livre para as outras conversas.
  void processN1Message({ ticket, contact, text: args.text, agent }).catch(error => logger.error(`[N1] Erro inesperado no ticket ${ticket.id}:`, error));
  return true;
}

async function processN1Message(args: { ticket: Ticket; contact: Contact; text: string; agent: N1Agent }): Promise<void> {
  const { ticket, contact, agent } = args;
  // Espera um pouco: se o cliente mandar outra mensagem, só a última é respondida (com todo o contexto).
  const markId = await latestCustomerMessageId(ticket.id);
  await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS));
  if ((await latestCustomerMessageId(ticket.id)) !== markId) return;
  if (running.has(ticket.id)) return;
  running.add(ticket.id);

  try {
    await ticket.reload();
    if (!n1CanHandle(ticket)) return; // alguém da equipe assumiu durante a espera

    const text = String(args.text || "").trim();
    const empty = { log: [] as string[], ticket: null, usage: { input: 0, output: 0, cacheRead: 0 }, servedBy: agent.model };

    // Pedido claro de falar com uma pessoa: transfere sem gastar uma chamada ao Claude.
    if (text && asksForHuman(text)) {
      await sendToCustomer(ticket, contact, HANDOFF_MESSAGE);
      await addPrivateNote(ticket, noteFor(agent.name, { ...empty, log: ["O cliente pediu para falar com uma pessoa."], handoff: { reason: "Cliente pediu atendente humano.", summary: "", urgency: "normal" } }));
      await handOff(ticket, contact, agent);
      return;
    }
    // Áudio, imagem, documento sem legenda: a equipe continua.
    if (!text) {
      await sendToCustomer(ticket, contact, NON_TEXT_MESSAGE);
      await addPrivateNote(ticket, noteFor(agent.name, { ...empty, log: ["Recebeu mensagem sem texto (áudio, imagem ou arquivo)."], handoff: { reason: "Mensagem sem texto.", summary: "", urgency: "normal" } }));
      await handOff(ticket, contact, agent);
      return;
    }
    // Limite de mensagens respondidas pelo N1 neste atendimento.
    if ((ticket.n1Turns || 0) >= Math.max(1, agent.maxTurns || 8)) {
      await sendToCustomer(ticket, contact, HANDOFF_MESSAGE);
      await addPrivateNote(ticket, noteFor(agent.name, { ...empty, log: [`Chegou ao limite de ${agent.maxTurns} mensagens respondidas pelo N1.`], handoff: { reason: "Limite de mensagens do N1.", summary: "", urgency: "normal" } }));
      await handOff(ticket, contact, agent);
      return;
    }

    const history = await recentTextMessages(ticket.id, HISTORY_LIMIT);
    const conversation = history.map(message => ({ fromCustomer: !message.fromMe, text: String(message.body || "").replace(/^‎\s*/, "") }));
    // Garante que a última fala do cliente está no fim (o salvamento pode atrasar um instante).
    if (!conversation.length || !conversation[conversation.length - 1].fromCustomer) conversation.push({ fromCustomer: true, text });

    const result = await runN1Turn({
      config: configOf(agent),
      conversation,
      customer: { name: customerFirstName(contact.name, "") },
      tools: toolsFor(agent, ticket, contact),
      createMessage: claudeFor(agent)
    });

    await ticket.update({ n1Turns: (ticket.n1Turns || 0) + 1 });
    const reply = result.reply || (result.handoff ? HANDOFF_MESSAGE : "");
    if (reply) await sendToCustomer(ticket, contact, reply);
    await addPrivateNote(ticket, noteFor(agent.name, result));
    if (result.handoff) await handOff(ticket, contact, agent);
    logger.info(`[N1] Ticket ${ticket.id}: ${result.handoff ? "transferido" : "respondido"} (${result.usage.input}+${result.usage.output} tokens, ${result.servedBy})`);
    return;
  } catch (error) {
    // Falha da API, do Portal ou de envio: o cliente recebe um aviso simples e a equipe assume.
    logger.error(`[N1] Erro no ticket ${ticket.id}:`, error);
    try {
      await sendToCustomer(ticket, contact, AI_FAILURE_MESSAGE);
    } catch (sendError) {
      logger.error(`[N1] Também não foi possível avisar o cliente do ticket ${ticket.id}:`, sendError);
    }
    await addPrivateNote(ticket, `🤖 ${agent.name} (N1)\n- Erro técnico ao responder; o atendimento foi passado para a equipe. Detalhes no log do servidor.`);
    await handOff(ticket, contact, agent);
    return;
  } finally {
    running.delete(ticket.id);
  }
}
