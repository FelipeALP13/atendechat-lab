import { Rule } from "./rules";
import { one, Store } from "./store";

export interface AgentConfig {
  name: string;
  /** Nome do produto sobre o qual o agente responde (entra no prompt). */
  product: string;
  introduceAsAssistant: boolean;
  answerAt: number;
  draftAt: number;
  /** Limite mensal em reais. O gasto do modelo é medido em dólar e convertido pela cotação abaixo. */
  monthlyCap: number;
  fx: number;
  /** Endereço do GitBook (https). Vazio = sem sincronização. */
  gitbookUrl: string;
  /** Regras de transferência ligadas. Segurança (prompt, credenciais, jurídico) não pode ser desligada. */
  handoffRules: Partial<Record<Rule, boolean>>;
  /** Fila do N2 para cada motivo de transferência; "default" vale para os demais. */
  queues: Record<string, number | null>;
}

export const defaultConfig: AgentConfig = {
  name: "Júlia",
  product: "SGE",
  introduceAsAssistant: true,
  answerAt: 75,
  draftAt: 60,
  monthlyCap: 300,
  fx: 5.5,
  gitbookUrl: "",
  handoffRules: { asks_human: true, repetition: true, billing_complaint: true, angry: true, outage: true },
  queues: { default: null },
};

/** Regras que o cliente pode ligar ou desligar. As de segurança ficam fora desta lista de propósito. */
const SWITCHABLE: Rule[] = ["asks_human", "repetition", "billing_complaint", "angry", "outage"];

export async function loadConfig(s: Store): Promise<AgentConfig> {
  const r = await one<{ value: string }>(s, `SELECT value FROM "N1Settings" WHERE "companyId" = $1 AND key = 'agent'`, [s.companyId]);
  const saved = r ? (JSON.parse(r.value) as Partial<AgentConfig>) : {};
  return { ...defaultConfig, ...saved, handoffRules: { ...defaultConfig.handoffRules, ...saved.handoffRules }, queues: { ...defaultConfig.queues, ...saved.queues } };
}

export async function saveConfig(s: Store, input: Partial<AgentConfig>): Promise<AgentConfig> {
  const next = await loadConfig(s);
  if (input.name !== undefined) {
    const n = String(input.name).trim();
    if (!n || n.length > 40) throw new Error("nome do agente deve ter de 1 a 40 caracteres");
    next.name = n;
  }
  if (input.product !== undefined) {
    const n = String(input.product).trim();
    if (!n || n.length > 60) throw new Error("nome do produto deve ter de 1 a 60 caracteres");
    next.product = n;
  }
  if (input.introduceAsAssistant !== undefined) next.introduceAsAssistant = Boolean(input.introduceAsAssistant);
  if (input.answerAt !== undefined) next.answerAt = Number(input.answerAt);
  if (input.draftAt !== undefined) next.draftAt = Number(input.draftAt);
  if (input.monthlyCap !== undefined) next.monthlyCap = Number(input.monthlyCap);
  if (input.fx !== undefined) {
    const f = Number(input.fx);
    if (!Number.isFinite(f) || f <= 0 || f > 100) throw new Error("cotação do dólar inválida");
    next.fx = f;
  }
  if (input.gitbookUrl !== undefined) {
    const u = String(input.gitbookUrl).trim();
    if (u) {
      let parsed: URL;
      try { parsed = new URL(u); } catch { throw new Error("endereço da documentação inválido"); }
      if (parsed.protocol !== "https:") throw new Error("o endereço da documentação deve usar https");
    }
    next.gitbookUrl = u;
  }
  if (input.handoffRules) {
    for (const [k, v] of Object.entries(input.handoffRules)) {
      if (!SWITCHABLE.includes(k as Rule)) throw new Error(`regra "${k}" não pode ser alterada`);
      next.handoffRules[k as Rule] = Boolean(v);
    }
  }
  if (input.queues) {
    for (const [k, v] of Object.entries(input.queues)) {
      if (v === null || v === undefined) { next.queues[k] = null; continue; }
      const id = Number(v);
      const ok = await one(s, `SELECT 1 FROM "Queues" WHERE id = $1 AND "companyId" = $2`, [id, s.companyId]);
      if (!ok) throw new Error(`fila ${id} não existe nesta empresa`);
      next.queues[k] = id;
    }
  }
  if (![next.answerAt, next.draftAt].every((x) => Number.isFinite(x) && x >= 0 && x <= 100)) throw new Error("limites devem ficar entre 0 e 100");
  if (next.draftAt >= next.answerAt) throw new Error("o limite de rascunho deve ser menor que o de resposta");
  if (!Number.isFinite(next.monthlyCap) || next.monthlyCap < 0) throw new Error("limite mensal inválido");
  await s.run(
    `INSERT INTO "N1Settings" ("companyId", key, value) VALUES ($1,'agent',$2) ON CONFLICT ("companyId", key) DO UPDATE SET value = EXCLUDED.value`,
    [s.companyId, JSON.stringify(next)],
  );
  return next;
}
