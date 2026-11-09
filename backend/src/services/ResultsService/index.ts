import { loadConfig } from "../AgentN1/config";
import { Store } from "../AgentN1/store";

const DAY = 86400000;
const round = (n: number, d = 2) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
/** Início do dia em Brasília (UTC-3, sem horário de verão desde 2019). */
const dayKey = (at: number) => at - ((at - 3 * 3600000) % DAY);

export interface ChannelResult {
  conversations: number;
  resolved: number;
  escalated: number;
  costBrl: number;
}

export interface Results {
  days: number;
  fx: number;
  totals: {
    conversations: number;
    resolved: number;
    escalated: number;
    resolvedPct: number;
    costUsd: number;
    costBrl: number;
    costPerConversationBrl: number;
    costPerResolvedBrl: number;
  };
  channels: { site: ChannelResult; whatsapp: ChannelResult };
  decisions: Record<string, number>;
  daily: { day: number; conversations: number; escalated: number; costBrl: number }[];
  campaigns: { campaign: string; sessions: number; conversations: number; escalated: number; leads: number; costBrl: number }[];
  topGaps: { question: string; times: number; lastAt: number }[];
}

/**
 * Resultado do agente em reais. "Resolvida" é a conversa em que o agente respondeu e nenhuma
 * transferência ou rascunho para o N2 aconteceu — é o que o agente tocou, não prova de que o
 * cliente ficou satisfeito.
 */
export async function results(s: Store, days: number, now = Date.now()): Promise<Results> {
  const fx = (await loadConfig(s)).fx;
  const since = now - days * DAY;

  const convs: { c: string; cost: number; escalated: boolean; at: number }[] = (
    await s.run(
      `SELECT conversation c, SUM(cost) cost, BOOL_OR(decision IN ('handoff','draft')) escalated, MIN(at) at
         FROM "N1Audit"
        WHERE "companyId" = $1 AND at >= $2 AND conversation IS NOT NULL
        GROUP BY conversation`,
      [s.companyId, since]
    )
  ).map(r => ({ c: String(r.c), cost: Number(r.cost) || 0, escalated: Boolean(r.escalated), at: Number(r.at) }));

  const isSite = (c: string) => c.indexOf("site:") === 0;
  const total = convs.length;
  const escalated = convs.filter(c => c.escalated).length;
  const resolved = total - escalated;
  const costUsd = convs.reduce((a, c) => a + c.cost, 0);
  const costBrl = costUsd * fx;

  const channel = (site: boolean): ChannelResult => {
    const list = convs.filter(c => isSite(c.c) === site);
    const esc = list.filter(c => c.escalated).length;
    return { conversations: list.length, resolved: list.length - esc, escalated: esc, costBrl: round(list.reduce((a, c) => a + c.cost, 0) * fx) };
  };

  const decisions: Record<string, number> = {};
  for (const r of await s.run(`SELECT decision, COUNT(*)::int n FROM "N1Audit" WHERE "companyId" = $1 AND at >= $2 GROUP BY decision`, [
    s.companyId,
    since
  ]))
    decisions[r.decision] = Number(r.n);

  const daily = new Map<number, { cost: number; conversations: number; escalated: number }>();
  for (const c of convs) {
    const k = dayKey(c.at);
    const d = daily.get(k) || { cost: 0, conversations: 0, escalated: 0 };
    d.cost += c.cost;
    d.conversations += 1;
    if (c.escalated) d.escalated += 1;
    daily.set(k, d);
  }

  // Campanha: vem do utm_campaign guardado quando o visitante abriu o chat no site.
  const camp = new Map<string, string>();
  for (const r of await s.run(`SELECT session, detail FROM "SiteEvents" WHERE "companyId" = $1 AND event = 'open' AND at >= $2`, [
    s.companyId,
    since
  ]))
    camp.set(String(r.session), r.detail || "sem campanha");

  const leadSessions = new Set(
    (await s.run(`SELECT DISTINCT session s FROM "SiteEvents" WHERE "companyId" = $1 AND event = 'lead' AND at >= $2`, [s.companyId, since])).map(
      r => String(r.s)
    )
  );

  const campaigns = new Map<string, Results["campaigns"][0]>();
  const slot = (name: string) => {
    if (!campaigns.has(name)) campaigns.set(name, { campaign: name, sessions: 0, conversations: 0, escalated: 0, leads: 0, costBrl: 0 });
    return campaigns.get(name);
  };
  camp.forEach((name, session) => {
    const row = slot(name);
    row.sessions += 1;
    if (leadSessions.has(session)) row.leads += 1;
  });
  for (const c of convs) {
    if (!isSite(c.c)) continue;
    const row = slot(camp.get(c.c.slice(5)) || "sem campanha");
    row.conversations += 1;
    if (c.escalated) row.escalated += 1;
    row.costBrl = round(row.costBrl + c.cost * fx);
  }

  const gaps = await s.run(
    `SELECT question, times, "lastAt" FROM "N1Proposals" WHERE "companyId" = $1 AND status = 'pending' ORDER BY times DESC, id LIMIT 5`,
    [s.companyId]
  );

  return {
    days,
    fx,
    totals: {
      conversations: total,
      resolved,
      escalated,
      resolvedPct: total ? round((resolved / total) * 100, 1) : 0,
      costUsd: round(costUsd, 4),
      costBrl: round(costBrl),
      costPerConversationBrl: total ? round(costBrl / total) : 0,
      costPerResolvedBrl: resolved ? round(costBrl / resolved) : 0
    },
    channels: { site: channel(true), whatsapp: channel(false) },
    decisions,
    daily: Array.from(daily.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, d]) => ({ day, conversations: d.conversations, escalated: d.escalated, costBrl: round(d.cost * fx) })),
    campaigns: Array.from(campaigns.values()).sort((a, b) => b.sessions - a.sessions),
    topGaps: gaps.map(g => ({ question: String(g.question), times: Number(g.times), lastAt: Number(g.lastAt) }))
  };
}
