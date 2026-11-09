import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { AgentReply, handleMessage } from "./agent";
import { loadConfig } from "./config";
import { llmFromEnv } from "./llm";
import { makeStore, Run, Store } from "./store";

/** Executa SQL no banco do sistema com parâmetros $1, $2… */
export const sqlRun: Run = async (sql, params = []) => {
  const [rows] = (await sequelize.query(sql, { bind: params as any[] })) as [any[], unknown];
  return Array.isArray(rows) ? rows : [];
};

export const n1Store = (companyId: number): Store => makeStore(companyId, sqlRun);

export interface AskInput {
  companyId: number;
  conversationId: string;
  message: string;
  history: string[];
  firstMessage: boolean;
  origin: string;
}

/** Pergunta ao agente da empresa. Sem chave do modelo configurada, não responde nada (devolve null). */
export async function askAgent(i: AskInput): Promise<AgentReply | null> {
  const llm = llmFromEnv();
  if (!llm) return null;
  const s = n1Store(i.companyId);
  const cfg = await loadConfig(s);
  return handleMessage(s, llm, cfg, i.message, { conversationId: i.conversationId, history: i.history, firstMessage: i.firstMessage, origin: i.origin });
}

const REASON_LABEL: Record<string, string> = {
  asks_human: "o cliente pediu uma pessoa",
  repetition: "o cliente repetiu a pergunta sem resolver",
  billing_complaint: "reclamação de cobrança",
  angry: "cliente irritado",
  outage: "possível indisponibilidade do sistema",
  low_confidence: "o agente não teve certeza da resposta",
  no_source: "a documentação não cobre a pergunta",
  cap: "limite mensal de gasto do agente atingido",
  draft: "o agente sugeriu um rascunho para revisão",
};

/** Resumo que o atendente humano (N2) lê ao assumir: aparece como nota interna na conversa. */
export function handoffNote(reply: AgentReply): string {
  const h = reply.handoff;
  const lines = [`🤖 Resumo do Agente N1`, `Motivo: ${REASON_LABEL[h ? h.reason : reply.reason] || reply.reason}.`];
  if (h) {
    lines.push(`Pergunta: ${h.question}`);
    if (h.history.length) lines.push(`Antes disso o cliente disse: ${h.history.join(" | ")}`);
    if (h.tried.length) lines.push(`Páginas consultadas: ${h.tried.join(", ")}`);
  }
  if (reply.draft) lines.push(`Rascunho sugerido (revise antes de enviar):\n${reply.draft}`);
  if (reply.confidence) lines.push(`Confiança: ${reply.confidence}%.`);
  return lines.join("\n");
}

/** Fila do N2 para o motivo: a configurada, a padrão, ou a primeira fila da conexão. */
export async function queueForReason(companyId: number, reason: string, connectionQueueIds: number[]): Promise<number | null> {
  const cfg = await loadConfig(n1Store(companyId));
  const q = cfg.queues[reason] ?? cfg.queues.default ?? null;
  return q || connectionQueueIds[0] || null;
}
