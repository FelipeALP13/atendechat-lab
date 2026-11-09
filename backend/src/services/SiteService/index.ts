import { randomBytes } from "crypto";
import { one, Run, Store, makeStore } from "../AgentN1/store";
import { sqlRun } from "../AgentN1/Runtime";
import {
  defaultSite,
  isOpen,
  palette,
  resolveText,
  sanitizeSite,
  scheduleLabel,
  SiteConfig,
  TEXTS,
  whatsappLink
} from "./core";

export const siteStore = (companyId: number, run: Run = sqlRun): Store => makeStore(companyId, run);

interface Row {
  companyId: number;
  token: string;
  draft: string | null;
  live: string | null;
  publishedAt: string | number | null;
}

const parse = (v: string | null): SiteConfig | null => {
  if (!v) return null;
  try {
    return JSON.parse(v) as SiteConfig;
  } catch (e) {
    return null;
  }
};

/** Linha da empresa; cria com token novo na primeira vez. O token vai na tag do site. */
export async function ensureRow(s: Store): Promise<Row> {
  const found = await one<Row>(s, `SELECT "companyId", token, draft, live, "publishedAt" FROM "SiteConfigs" WHERE "companyId" = $1`, [s.companyId]);
  if (found) return found;
  const token = randomBytes(12).toString("hex");
  await s.run(`INSERT INTO "SiteConfigs" ("companyId", token) VALUES ($1, $2) ON CONFLICT ("companyId") DO NOTHING`, [s.companyId, token]);
  return (await one<Row>(s, `SELECT "companyId", token, draft, live, "publishedAt" FROM "SiteConfigs" WHERE "companyId" = $1`, [s.companyId])) as Row;
}

/** Gera um token novo: a tag antiga para de funcionar. */
export async function rotateToken(s: Store): Promise<string> {
  await ensureRow(s);
  const token = randomBytes(12).toString("hex");
  await s.run(`UPDATE "SiteConfigs" SET token = $2, "updatedAt" = NOW() WHERE "companyId" = $1`, [s.companyId, token]);
  return token;
}

/** Publicado: o que o visitante vê. Rascunho: o que está sendo editado. */
export async function loadLive(s: Store): Promise<SiteConfig> {
  const r = await ensureRow(s);
  return parse(r.live) || defaultSite();
}
export async function loadDraft(s: Store): Promise<SiteConfig> {
  const r = await ensureRow(s);
  return parse(r.draft) || parse(r.live) || defaultSite();
}

export interface SiteState {
  site: SiteConfig;
  published: boolean;
  publishedAt: number | null;
  token: string;
  notes?: string[];
}

export async function siteState(s: Store): Promise<SiteState> {
  const r = await ensureRow(s);
  const draft = parse(r.draft) || parse(r.live) || defaultSite();
  const live = parse(r.live);
  return {
    site: draft,
    published: Boolean(live) && JSON.stringify(draft) === JSON.stringify(live),
    publishedAt: Number(r.publishedAt || 0) || null,
    token: r.token
  };
}

export async function saveDraft(s: Store, patch: unknown): Promise<SiteState> {
  const base = await loadDraft(s);
  const { site, notes } = sanitizeSite(patch, base);
  await s.run(`UPDATE "SiteConfigs" SET draft = $2, "updatedAt" = NOW() WHERE "companyId" = $1`, [s.companyId, JSON.stringify(site)]);
  const state = await siteState(s);
  return { ...state, notes };
}

export async function publish(s: Store, now = Date.now()): Promise<SiteState> {
  const draft = await loadDraft(s);
  await s.run(`UPDATE "SiteConfigs" SET draft = $2, live = $2, "publishedAt" = $3, "updatedAt" = NOW() WHERE "companyId" = $1`, [
    s.companyId,
    JSON.stringify(draft),
    now
  ]);
  return siteState(s);
}

/** Descarta o rascunho e volta ao que está publicado. */
export async function discardDraft(s: Store): Promise<SiteState> {
  await s.run(`UPDATE "SiteConfigs" SET draft = live, "updatedAt" = NOW() WHERE "companyId" = $1`, [s.companyId]);
  return siteState(s);
}

// ---------- eventos e funil ----------
export type Ev = "open" | "message" | "answered" | "handoff" | "lead";

export const logEvent = async (s: Store, session: string, event: Ev, at = Date.now(), detail?: string): Promise<void> => {
  await s.run(`INSERT INTO "SiteEvents" ("companyId", at, session, event, detail) VALUES ($1,$2,$3,$4,$5)`, [
    s.companyId,
    at,
    session,
    event,
    detail || null
  ]);
};

export interface Funnel {
  days: number;
  steps: { id: string; label: string; n: number }[];
  handoffQuestions: { q: string; n: number }[];
}

/** Funil: quantas sessões chegaram em cada etapa, e o que mais levou a chamar uma pessoa. */
export async function funnel(s: Store, days: number, now = Date.now()): Promise<Funnel> {
  const since = now - days * 86400000;
  const rows = await s.run(
    `SELECT event, COUNT(DISTINCT session)::int n FROM "SiteEvents" WHERE "companyId" = $1 AND at >= $2 GROUP BY event`,
    [s.companyId, since]
  );
  const byEvent: Record<string, number> = {};
  for (const r of rows) byEvent[r.event] = Number(r.n);
  const steps = [
    { id: "open", label: "Abriram o chat", n: byEvent.open || 0 },
    { id: "message", label: "Enviaram uma pergunta", n: byEvent.message || 0 },
    { id: "answered", label: "Foram resolvidas pelo assistente", n: byEvent.answered || 0 },
    { id: "handoff", label: "Precisaram de uma pessoa", n: byEvent.handoff || 0 },
    { id: "lead", label: "Deixaram contato", n: byEvent.lead || 0 }
  ];
  const top = await s.run(
    `SELECT detail q, COUNT(*)::int n FROM "SiteEvents"
      WHERE "companyId" = $1 AND event = 'handoff' AND at >= $2 AND detail IS NOT NULL
      GROUP BY detail ORDER BY n DESC LIMIT 10`,
    [s.companyId, since]
  );
  return { days, steps, handoffQuestions: top.map(r => ({ q: r.q, n: Number(r.n) })) };
}

export const listLeads = (s: Store) =>
  s.run(`SELECT id, at, name, contact, question, status, "ticketId" FROM "SiteLeads" WHERE "companyId" = $1 ORDER BY id DESC LIMIT 200`, [
    s.companyId
  ]);

export async function setLeadStatus(s: Store, id: number, status: string): Promise<void> {
  if (["new", "done", "discarded"].indexOf(status) < 0) throw new Error("situação inválida");
  await s.run(`UPDATE "SiteLeads" SET status = $3 WHERE "companyId" = $1 AND id = $2`, [s.companyId, id, status]);
}

// ---------- chat público ----------
const hits = new Map<string, number[]>();

/**
 * Janela deslizante em memória, para proteger o orçamento do modelo contra abuso.
 * Vale por processo: com várias instâncias do backend, o limite é por instância.
 */
export function limited(key: string, max: number, windowMs: number, now: number): boolean {
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  return false;
}
export const resetLimits = () => hits.clear();

/** O que o widget recebe: marca, textos prontos e se a equipe está no horário. */
export async function publicConfig(s: Store, now = Date.now()) {
  const site = await loadLive(s);
  const vars = { nome: site.brand.agentName, horario: scheduleLabel(site.chat.schedule) };
  return {
    enabled: site.chat.enabled,
    brand: { name: site.brand.name, logoUrl: site.brand.logoUrl, position: site.brand.position, ...palette(site.brand.color) },
    texts: Object.fromEntries(TEXTS.map(t => [t.key, resolveText(site, t.key, vars)])),
    whatsapp: whatsappLink(site.contact.whatsapp),
    teamOnline: isOpen(site.chat.schedule, now)
  };
}

export const originAllowed = (site: SiteConfig, origin: string): boolean =>
  !site.chat.origins.length || site.chat.origins.indexOf(origin.toLowerCase().replace(/\/$/, "")) >= 0;

/** Empresa de um token público. */
export async function companyByToken(token: string, run: Run = sqlRun): Promise<number | null> {
  if (!/^[a-f0-9]{8,48}$/i.test(token)) return null;
  const rows = await run(`SELECT "companyId" FROM "SiteConfigs" WHERE token = $1`, [token]);
  return rows.length ? Number(rows[0].companyId) : null;
}

/** Quantas perguntas já entraram hoje, para o limite diário. */
export async function messagesToday(s: Store, now = Date.now()): Promise<number> {
  const day = now - (now % 86400000);
  const r = await one<{ n: string }>(s, `SELECT COUNT(*)::int n FROM "SiteEvents" WHERE "companyId" = $1 AND event = 'message' AND at >= $2`, [
    s.companyId,
    day
  ]);
  return Number(r ? r.n : 0);
}

export async function createLead(
  s: Store,
  data: { session: string; name: string; contact: string; question?: string },
  now = Date.now()
): Promise<void> {
  await s.run(`INSERT INTO "SiteLeads" ("companyId", at, session, name, contact, question) VALUES ($1,$2,$3,$4,$5,$6)`, [
    s.companyId,
    now,
    data.session,
    data.name,
    data.contact,
    data.question || null
  ]);
  await logEvent(s, data.session, "lead", now);
}

export { SiteConfig, defaultSite, sanitizeSite, resolveText, scheduleLabel, isOpen, TEXTS } from "./core";
