import { fold, jaccard } from "./text";

export type Rule =
  | "asks_human" | "asks_if_ai" | "prompt_extraction" | "credentials" | "legal"
  | "angry" | "billing_complaint" | "repetition" | "outage" | "other_system";

const has = (t: string, re: RegExp) => re.test(t);

/** Regras que valem antes de qualquer busca. A ordem importa: segurança primeiro. */
export function checkRules(message: string, history: string[]): Rule | null {
  const t = fold(message);
  if (has(t, /(ignore|esqueca|desconsidere)\b.*\b(instrucoes|regras|prompt)|(mostre|revele|me passe|qual).*\b(seu|o|teu)\b.*\b(prompt|instrucoes)|system prompt/)) return "prompt_extraction";
  if (has(t, /(voce|vc|tu|ce)\s*(e|eh|ta|esta)?\s*(um|uma)?\s*(robo|bot|ia\b|inteligencia artificial|maquina|humano|pessoa de verdade|gente de verdade)|estou falando com (um|uma)? ?(robo|bot|humano|pessoa|ia)|isso e (um )?(robo|bot)/)) return "asks_if_ai";
  if (has(t, /senha (d[oae]s?|dele|dela)|(me )?(passa|passe|informe|envie|manda)\b.*\bsenha|esqueci.*senha.*(de outro|do colega)/)) return "credentials";
  if (has(t, /(falar|conversar|passa(r)?|chama(r)?|quero|preciso).{0,25}(atendente|humano|pessoa|alguem de verdade|supervisor|gerente)/)) return "asks_human";
  if (has(t, /estrategia juridica|devo processar|chance de ganhar|melhor tese|advogad[oa]/)) return "legal";
  if (has(t, /(fora do ar|esta fora|caiu|nao abre|nao carrega|instavel|indisponivel).{0,20}(sge|sistema|site|portal)|(sge|sistema).{0,20}(fora do ar|caiu|nao abre|indisponivel)/)) return "outage";
  if (has(t, /absurdo|palhacada|vergonha|horrivel|ridiculo|inaceitavel|procon|reclame aqui|ja falei|cansado|nunca resolvem|pessimo|lixo/) || (message.length > 15 && message === message.toUpperCase() && /[A-Z]{6}/.test(message))) return "angry";
  if (has(t, /cobraram (duas|2|em duplicidade)|cobranca (indevida|duplicada)|quero (meu )?(estorno|reembolso)|estorno|reembolso|contestar (a )?cobranca/)) return "billing_complaint";
  if (has(t, /\b(totvs|protheus|sap|salesforce|excel|word|photoshop|windows|linux|iphone|android)\b/) && !has(t, /sge|hermanos|importar|planilha|layout/)) return "other_system";
  const same = history.filter((h) => jaccard(h, message) >= 0.7).length;
  if (same >= 2) return "repetition";
  return null;
}
