import { Request, Response } from "express";
import { askAgent } from "../services/AgentN1/Runtime";
import {
  companyByToken,
  createLead,
  limited,
  loadLive,
  logEvent,
  messagesToday,
  originAllowed,
  publicConfig,
  siteStore
} from "../services/SiteService";
import { isContact, isOpen, resolveText, scheduleLabel, SiteConfig } from "../services/SiteService/core";
import { widgetSource } from "../services/SiteService/widget";

/**
 * Rotas públicas do chat do site: /site/:token/(widget.js|config|chat|lead).
 * Não há login aqui; o que protege é o token, a lista de sites permitidos,
 * os limites por sessão e por IP e o limite de gasto do agente.
 */

const cors = (req: Request, res: Response, site: SiteConfig | null): void => {
  const origin = String(req.headers.origin || "");
  res.setHeader("cache-control", "no-store");
  if (!origin || !site || !originAllowed(site, origin)) return;
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "origin");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
};

const ipOf = (req: Request) =>
  String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();

const resolve = async (req: Request) => {
  const companyId = await companyByToken(String(req.params.token || ""));
  if (!companyId) return null;
  const s = siteStore(companyId);
  return { s, site: await loadLive(s) };
};

export const widget = async (req: Request, res: Response): Promise<void> => {
  const token = String(req.params.token || "");
  const companyId = await companyByToken(token);
  res.setHeader("cache-control", "no-store");
  res.setHeader("content-type", "application/javascript; charset=utf-8");
  if (!companyId) {
    res.status(404).send("// site não encontrado");
    return;
  }
  const base = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  res.send(widgetSource(base, token));
};

export const options = async (req: Request, res: Response): Promise<void> => {
  const r = await resolve(req);
  cors(req, res, r ? r.site : null);
  res.status(204).end();
};

export const config = async (req: Request, res: Response): Promise<void> => {
  const r = await resolve(req);
  if (!r) {
    res.status(404).json({ error: "site não encontrado" });
    return;
  }
  cors(req, res, r.site);
  const origin = String(req.headers.origin || "");
  if (origin && !originAllowed(r.site, origin)) {
    res.status(403).json({ error: "site não autorizado" });
    return;
  }
  res.json(await publicConfig(r.s));
};

const session = (req: Request) => {
  const v = String((req.body || {}).session || "").slice(0, 64);
  return /^[a-z0-9-]{8,64}$/i.test(v) ? v : null;
};

export const lead = async (req: Request, res: Response): Promise<void> => {
  const r = await resolve(req);
  if (!r) {
    res.status(404).json({ error: "site não encontrado" });
    return;
  }
  cors(req, res, r.site);
  const origin = String(req.headers.origin || "");
  if (origin && !originAllowed(r.site, origin)) {
    res.status(403).json({ error: "site não autorizado" });
    return;
  }
  const sess = session(req);
  if (!sess) {
    res.status(400).json({ error: "sessão inválida" });
    return;
  }
  if (limited(`ip:${ipOf(req)}`, 120, 3600000, Date.now())) {
    res.status(429).json({ error: "limit" });
    return;
  }
  const b = req.body || {};
  const name = String(b.name || "").trim().slice(0, 80);
  const contact = String(b.contact || "").trim().slice(0, 120);
  if (!name || !isContact(contact)) {
    res.status(400).json({ error: "invalid" });
    return;
  }
  await createLead(r.s, { session: sess, name, contact, question: String(b.question || "").slice(0, 500) });
  res.status(201).json({ ok: true });
};

export const chat = async (req: Request, res: Response): Promise<void> => {
  const r = await resolve(req);
  if (!r) {
    res.status(404).json({ error: "site não encontrado" });
    return;
  }
  cors(req, res, r.site);
  const origin = String(req.headers.origin || "");
  if (origin && !originAllowed(r.site, origin)) {
    res.status(403).json({ error: "site não autorizado" });
    return;
  }
  if (!r.site.chat.enabled) {
    res.status(503).json({ error: "closed" });
    return;
  }
  const sess = session(req);
  if (!sess) {
    res.status(400).json({ error: "sessão inválida" });
    return;
  }
  const now = Date.now();
  if (limited(`ip:${ipOf(req)}`, 120, 3600000, now)) {
    res.status(429).json({ error: "limit" });
    return;
  }
  const b = req.body || {};

  if (b.event === "open") {
    const campaign = String(b.campaign || "").replace(/[^\w.\- ]/g, "").slice(0, 60);
    await logEvent(r.s, sess, "open", now, campaign || undefined);
    res.json({ ok: true });
    return;
  }

  const text = String(b.text || "").trim().slice(0, 1000);
  if (!text) {
    res.status(400).json({ error: "texto obrigatório" });
    return;
  }
  if (limited(`s:${sess}`, 30, 3600000, now)) {
    res.status(429).json({ error: "limit" });
    return;
  }
  if (r.site.chat.dailyLimit !== null && (await messagesToday(r.s, now)) >= r.site.chat.dailyLimit) {
    res.status(429).json({ error: "limit" });
    return;
  }

  const history = Array.isArray(b.history) ? b.history.map((h: unknown) => String(h).slice(0, 1000)).slice(-10) : [];
  await logEvent(r.s, sess, "message", now);

  const reply = await askAgent({
    companyId: r.s.companyId,
    conversationId: `site:${sess}`,
    message: text,
    history,
    firstMessage: history.length === 0,
    origin: "site"
  });

  const teamOnline = isOpen(r.site.chat.schedule, now);
  const offHours = () =>
    resolveText(r.site, "chat.offHours", { horario: scheduleLabel(r.site.chat.schedule), nome: r.site.brand.agentName });

  // Sem chave do modelo configurada: o chat não inventa resposta, pede o contato.
  if (!reply) {
    await logEvent(r.s, sess, "handoff", now, text.slice(0, 200));
    res.json({
      decision: "handoff",
      messages: [{ text: "Vou chamar uma pessoa da equipe para te ajudar com isso.", delayMs: 900 }],
      handoff: true,
      teamOnline,
      note: teamOnline ? null : offHours()
    });
    return;
  }

  const handoff = reply.decision === "handoff" || reply.decision === "draft";
  // Só conta como resolvida a resposta de verdade: recusa e "sou uma IA" não resolvem nem transferem.
  if (handoff) await logEvent(r.s, sess, "handoff", now, text.slice(0, 200));
  else if (reply.decision === "answer") await logEvent(r.s, sess, "answered", now);

  // No rascunho o texto fica para a equipe, não vai ao cliente: aqui só pedimos o contato.
  const messages = reply.messages.length
    ? reply.messages
    : [{ text: "Essa eu prefiro confirmar com alguém da equipe para não te passar nada errado.", delayMs: 900 }];

  res.json({
    decision: reply.decision,
    messages,
    handoff,
    teamOnline,
    note: handoff && !teamOnline ? offHours() : null
  });
};
