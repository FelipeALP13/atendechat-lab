import { Request, Response } from "express";
import AppError from "../errors/AppError";
import N1Agent from "../models/N1Agent";
import Queue from "../models/Queue";
import Whatsapp from "../models/Whatsapp";
import { decryptSecret, isMaskedOrEmpty } from "../helpers/secretBox";
import { createPortalClient, normalizePortalUrl } from "../services/N1AgentService/portalClient";
import { N1_EFFORTS, N1_MODELS, runN1Turn } from "../services/N1AgentService/n1Core";
import { claudeFor, configOf } from "../services/N1AgentService/n1Service";
import logger from "../utils/logger";

/** Configuração do agente N1 da empresa (só administradores). */

const requireAdmin = (req: Request) => {
  if (req.user?.profile !== "admin") throw new AppError("Só administradores configuram o agente N1.", 403);
};

const MAX_INSTRUCTIONS = 8000;

async function loadAgent(companyId: number) {
  return N1Agent.findOne({ where: { companyId } });
}

export const show = async (req: Request, res: Response): Promise<Response> => {
  requireAdmin(req);
  const { companyId } = req.user;
  const [agent, whatsapps, queues] = await Promise.all([
    loadAgent(companyId),
    Whatsapp.findAll({ where: { companyId }, attributes: ["id", "name", "channel", "status"], order: [["name", "ASC"]] }),
    Queue.findAll({ where: { companyId }, attributes: ["id", "name", "color"], order: [["name", "ASC"]] })
  ]);
  return res.json({
    agent: agent ? agent.toJSON() : null,
    options: { whatsapps, queues, models: N1_MODELS, efforts: N1_EFFORTS }
  });
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  requireAdmin(req);
  const { companyId } = req.user;
  const body = req.body || {};
  const name = String(body.name ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || "Assistente";
  const model = (N1_MODELS as readonly string[]).includes(body.model) ? body.model : "claude-opus-5-5";
  const effort = (N1_EFFORTS as readonly string[]).includes(body.effort) ? body.effort : "medium";
  const maxTurns = Math.min(30, Math.max(1, parseInt(body.maxTurns, 10) || 8));
  const instructions = String(body.instructions ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_INSTRUCTIONS);
  const portalUrl = body.portalUrl ? normalizePortalUrl(body.portalUrl) : null;
  if (body.portalUrl && !portalUrl) throw new AppError("Endereço do Portal inválido (use https://...).", 400);

  // Só conexões e fila da própria empresa.
  const requested: number[] = Array.isArray(body.whatsappIds) ? body.whatsappIds.map(Number).filter(Number.isInteger) : [];
  const whatsappIds = requested.length ? (await Whatsapp.findAll({ where: { companyId, id: requested }, attributes: ["id"] })).map(w => w.id) : [];
  let handoffQueueId: number | null = null;
  if (body.handoffQueueId) {
    const queue = await Queue.findOne({ where: { companyId, id: Number(body.handoffQueueId) }, attributes: ["id"] });
    if (!queue) throw new AppError("Fila não encontrada.", 400);
    handoffQueueId = queue.id;
  }

  let agent = await loadAgent(companyId);
  const values: Partial<N1Agent> = { name, model, effort, maxTurns, instructions, portalUrl, whatsappIds, handoffQueueId, enabled: body.enabled === true };
  // Chaves: a tela recebe mascaradas; se voltarem assim (ou vazias), ficam as salvas. "remover" apaga.
  if (body.apiKey === null) values.apiKey = null;
  else if (!isMaskedOrEmpty(body.apiKey)) values.apiKey = String(body.apiKey).trim();
  if (body.portalKey === null) values.portalKey = null;
  else if (!isMaskedOrEmpty(body.portalKey)) values.portalKey = String(body.portalKey).trim();

  const apiKey = values.apiKey !== undefined ? values.apiKey : agent?.apiKey;
  if (values.enabled && !apiKey) throw new AppError("Informe a chave da API da Anthropic antes de ligar o N1.", 400);
  if (values.enabled && !whatsappIds.length) throw new AppError("Escolha pelo menos uma conexão onde o N1 vai atender.", 400);

  if (agent) await agent.update(values);
  else agent = await N1Agent.create({ ...values, companyId } as N1Agent);
  await agent.reload();
  return res.json({ agent: agent.toJSON() });
};

/** Confere se a chave do Portal funciona (faz uma busca de teste, só leitura). */
export const testPortal = async (req: Request, res: Response): Promise<Response> => {
  requireAdmin(req);
  const agent = await loadAgent(req.user.companyId);
  const url = normalizePortalUrl(agent?.portalUrl);
  if (!agent || !url || !agent.portalKey) throw new AppError("Salve o endereço e a chave do Portal primeiro.", 400);
  try {
    const articles = await createPortalClient(url, decryptSecret(agent.portalKey)).searchKnowledge(String(req.body?.query || "acesso"));
    return res.json({ ok: true, articles: articles.map(article => ({ id: article.id, title: article.title })) });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Falha ao falar com o Portal." });
  }
};

/**
 * Conversa de teste na tela de configuração: usa o Claude e a base de verdade,
 * mas não manda nada a cliente, não transfere e não abre chamado (o chamado é simulado).
 */
export const simulate = async (req: Request, res: Response): Promise<Response> => {
  requireAdmin(req);
  const agent = await loadAgent(req.user.companyId);
  if (!agent?.apiKey) throw new AppError("Salve a chave da API da Anthropic primeiro.", 400);
  const lines = Array.isArray(req.body?.messages) ? req.body.messages.slice(-20) : [];
  const conversation = lines
    .map((line: { fromCustomer?: unknown; text?: unknown }) => ({ fromCustomer: line.fromCustomer === true, text: String(line.text ?? "").slice(0, 2000) }))
    .filter((line: { text: string }) => line.text.trim());
  if (!conversation.length || !conversation[conversation.length - 1].fromCustomer) throw new AppError("Escreva a mensagem do cliente.", 400);

  const url = normalizePortalUrl(agent.portalUrl);
  const portal = url && agent.portalKey ? createPortalClient(url, decryptSecret(agent.portalKey)) : null;
  try {
    const result = await runN1Turn({
      config: configOf(agent),
      conversation,
      customer: { name: String(req.body?.customerName || "Cliente de teste").slice(0, 40) },
      tools: {
        searchKnowledge: async query => (portal ? portal.searchKnowledge(query) : []),
        openTicket: async () => ({ code: "CH-TESTE", duplicate: false })
      },
      createMessage: claudeFor(agent)
    });
    return res.json(result);
  } catch (error) {
    logger.error("[N1] Falha na conversa de teste:", error);
    const status = (error as { status?: number })?.status;
    const message = status === 401 ? "A chave da Anthropic foi recusada." : status === 429 ? "Limite de uso da Anthropic atingido; tente em instantes." : "Não foi possível falar com o Claude agora.";
    return res.status(502).json({ error: message });
  }
};
