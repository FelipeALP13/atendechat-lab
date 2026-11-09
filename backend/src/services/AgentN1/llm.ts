export interface LlmResult {
  text: string;
  /** false quando as fontes não respondem a pergunta. Ausente = não avaliado (provedor de teste). */
  answerable?: boolean;
  /** Custo em dólar, como a Anthropic cobra. A conversão para reais usa a cotação configurada. */
  cost: number;
}

export interface Llm {
  complete(args: { system: string; user: string }): Promise<LlmResult>;
}

/**
 * Provedor Claude pela API da Anthropic. Os preços padrão (US$ 3 e US$ 15 por milhão de tokens) são uma
 * estimativa: confira o modelo escolhido em anthropic.com/pricing e ajuste com N1_PRICE_IN e N1_PRICE_OUT.
 */
export function anthropicLlm(opts: { apiKey: string; model: string; usdPerMTokIn?: number; usdPerMTokOut?: number; fetchFn?: typeof fetch }): Llm {
  const pin = opts.usdPerMTokIn ?? 3;
  const pout = opts.usdPerMTokOut ?? 15;
  const doFetch = opts.fetchFn || fetch;
  return {
    async complete({ system, user }) {
      const r = await doFetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: opts.model, max_tokens: 600, system, messages: [{ role: "user", content: user }] }),
      });
      if (!r.ok) throw new Error(`LLM ${r.status}`);
      const j = (await r.json()) as { content: { text: string }[]; usage: { input_tokens: number; output_tokens: number } };
      const raw = j.content.map((c) => c.text).join("").trim();
      const m = raw.match(/^RESPONDIVEL:\s*(SIM|NAO|NÃO)\s*\n?([\s\S]*)$/i);
      return {
        answerable: m ? m[1].toUpperCase() === "SIM" : false,
        text: m ? m[2].trim() : raw,
        cost: (j.usage.input_tokens * pin + j.usage.output_tokens * pout) / 1_000_000,
      };
    },
  };
}

/** Provedor de teste: monta a resposta com o primeiro trecho encontrado. Não inventa nada. */
export const extractiveLlm: Llm = {
  async complete({ user }) {
    const m = user.match(/\[FONTE 1\]\n([\s\S]*?)(?:\n\[FONTE 2\]|\n\[PERGUNTA\]|$)/);
    const src = ((m && m[1]) || "").split("\n").slice(1).join("\n").trim();
    return { text: src.slice(0, 700), cost: 0.01 };
  },
};

/** Provedor da empresa: chave própria (configuração) ou a do ambiente. Sem nenhuma, devolve null e o agente não responde. */
export function llmFromEnv(apiKey?: string): Llm | null {
  const key = apiKey || process.env.N1_ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return anthropicLlm({
    apiKey: key,
    model: process.env.N1_MODEL || "claude-sonnet-5-5",
    usdPerMTokIn: process.env.N1_PRICE_IN ? Number(process.env.N1_PRICE_IN) : undefined,
    usdPerMTokOut: process.env.N1_PRICE_OUT ? Number(process.env.N1_PRICE_OUT) : undefined,
  });
}
