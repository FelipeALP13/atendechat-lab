import { buildTools, noteFor, runN1Turn, toMessages, N1Config, N1Tools } from "../../services/N1AgentService/n1Core";

/** Claude simulado: devolve as respostas roteirizadas, em ordem, e guarda o que recebeu. */
function fakeClaude(script: any[]) {
  const calls: any[] = [];
  const createMessage = async (params: any) => {
    calls.push(JSON.parse(JSON.stringify(params)));
    const next = script.shift();
    if (!next) throw new Error("roteiro acabou");
    return { model: "claude-opus-5-5", usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 80 }, ...next };
  };
  return { createMessage: createMessage as any, calls };
}

const text = (value: string) => ({ type: "text", text: value });
const tool = (id: string, name: string, input: Record<string, unknown>) => ({ type: "tool_use", id, name, input });

const config: N1Config = { name: "Ana", instructions: "Somos a Loja Aurora.", model: "claude-opus-5-5", effort: "medium", portalEnabled: true };
const customer = { name: "Mariana" };

function tools(overrides: Partial<N1Tools> = {}) {
  const used: string[] = [];
  const impl: N1Tools = {
    searchKnowledge: async query => { used.push(`busca:${query}`); return [{ id: 1, title: "Segunda via do boleto", body: "Acesse Financeiro > Boletos." }]; },
    openTicket: async input => { used.push(`chamado:${input.title}:${input.urgency}`); return { code: "CH-90", duplicate: false }; },
    ...overrides
  };
  return { impl, used };
}

const ask = (message: string) => [{ fromCustomer: true, text: message }];

describe("N1 - núcleo", () => {
  it("busca na base e responde com o artigo", async () => {
    const { createMessage, calls } = fakeClaude([
      { stop_reason: "tool_use", content: [text("Vou verificar."), tool("t1", "buscar_base_conhecimento", { consulta: "segunda via boleto" })] },
      { stop_reason: "end_turn", content: [text("Mariana, acesse Financeiro > Boletos para a segunda via.")] }
    ]);
    const { impl, used } = tools();
    const result = await runN1Turn({ config, conversation: ask("como tiro a segunda via do boleto?"), customer, tools: impl, createMessage });

    expect(result.reply).toContain("Financeiro > Boletos");
    expect(result.handoff).toBeNull();
    expect(used).toEqual(["busca:segunda via boleto"]);
    expect(result.log[0]).toContain('Buscou na base: "segunda via boleto" (1 artigo');
    expect(result.usage).toEqual({ input: 200, output: 40, cacheRead: 160 });

    // Pedido montado do jeito certo.
    const first = calls[0];
    expect(first.model).toBe("claude-opus-5-5");
    expect(first.output_config).toEqual({ effort: "medium" });
    expect(first.fallbacks).toBe("default");
    expect(first.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(first.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(first.system[0].text).toContain("Somos a Loja Aurora.");
    expect(first.system[1].text).toContain("Mariana");
    expect(first.tools.every((t: any) => t.strict === true && t.input_schema.additionalProperties === false)).toBe(true);
    expect(first.thinking).toBeUndefined();
    // A segunda chamada leva a resposta anterior inteira e o resultado da busca.
    const second = calls[1];
    expect(second.messages[1].role).toBe("assistant");
    expect(second.messages[1].content[1].type).toBe("tool_use");
    expect(second.messages[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "t1" });
    expect(second.messages[2].content[0].content).toContain("### Segunda via do boleto");
  });

  it("transfere com resumo quando não sabe", async () => {
    const { createMessage } = fakeClaude([
      { stop_reason: "tool_use", content: [tool("t1", "transferir_para_atendente", { motivo: "Cobrança contestada", resumo: "Cliente diz que foi cobrada duas vezes.", urgencia: "high" })] },
      { stop_reason: "end_turn", content: [text("Vou passar para um atendente, só um instante.")] }
    ]);
    const result = await runN1Turn({ config, conversation: ask("fui cobrada duas vezes!"), customer, tools: tools().impl, createMessage });
    expect(result.handoff).toEqual({ reason: "Cobrança contestada", summary: "Cliente diz que foi cobrada duas vezes.", urgency: "high" });
    expect(result.reply).toContain("atendente");
    const note = noteFor("Ana", result);
    expect(note).toContain("urgência alta");
    expect(note).toContain("Resumo:\nCliente diz que foi cobrada duas vezes.");
  });

  it("abre chamado no Portal e transfere", async () => {
    const { createMessage } = fakeClaude([
      { stop_reason: "tool_use", content: [tool("t1", "abrir_chamado", { titulo: "Erro ao emitir nota", descricao: "Erro 500 desde ontem.", urgencia: "urgentissimo" })] },
      { stop_reason: "tool_use", content: [tool("t2", "transferir_para_atendente", { motivo: "Erro no sistema", resumo: "Chamado CH-90 aberto.", urgencia: "normal" })] },
      { stop_reason: "end_turn", content: [text("Abri o chamado CH-90 e um atendente vai continuar.")] }
    ]);
    const { impl, used } = tools();
    const result = await runN1Turn({ config, conversation: ask("o sistema dá erro ao emitir nota"), customer, tools: impl, createMessage });
    expect(used).toEqual(["chamado:Erro ao emitir nota:normal"]); // urgência inválida vira "normal"
    expect(result.ticket).toEqual({ code: "CH-90", duplicate: false });
    expect(result.handoff?.reason).toBe("Erro no sistema");
    expect(result.reply).toContain("CH-90");
  });

  it("recusa do modelo vira transferência, sem resposta ao cliente", async () => {
    const { createMessage } = fakeClaude([{ stop_reason: "refusal", content: [] }]);
    const result = await runN1Turn({ config, conversation: ask("..."), customer, tools: tools().impl, createMessage });
    expect(result.reply).toBe("");
    expect(result.handoff).not.toBeNull();
  });

  it("falha do Portal volta como erro para o modelo e a conversa segue", async () => {
    const { createMessage, calls } = fakeClaude([
      { stop_reason: "tool_use", content: [tool("t1", "buscar_base_conhecimento", { consulta: "prazo" })] },
      { stop_reason: "end_turn", content: [text("Vou confirmar com a equipe.")] }
    ]);
    const { impl } = tools({ searchKnowledge: async () => { throw new Error("Portal fora do ar"); } });
    const result = await runN1Turn({ config, conversation: ask("qual o prazo?"), customer, tools: impl, createMessage });
    expect(calls[1].messages[2].content[0]).toMatchObject({ is_error: true });
    expect(result.log[0]).toContain("Falhou ao usar buscar_base_conhecimento: Portal fora do ar");
    expect(result.reply).toBe("Vou confirmar com a equipe.");
  });

  it("para depois de muitas voltas e passa para a equipe", async () => {
    const loop = Array.from({ length: 6 }, (_, i) => ({ stop_reason: "tool_use", content: [tool(`t${i}`, "buscar_base_conhecimento", { consulta: `x${i}` })] }));
    const { createMessage, calls } = fakeClaude(loop);
    const result = await runN1Turn({ config, conversation: ask("?"), customer, tools: tools().impl, createMessage });
    expect(calls).toHaveLength(6);
    expect(result.handoff).not.toBeNull();
  });

  it("sem Portal: só a ferramenta de transferir", () => {
    expect(buildTools({ ...config, portalEnabled: false }).map(t => t.name)).toEqual(["transferir_para_atendente"]);
    expect(buildTools(config).map(t => t.name)).toEqual(["buscar_base_conhecimento", "abrir_chamado", "transferir_para_atendente"]);
  });

  it("monta a conversa começando pelo cliente e não responde se a última fala é da empresa", async () => {
    expect(toMessages([
      { fromCustomer: false, text: "Olá! Bem-vindo." },
      { fromCustomer: true, text: "oi" },
      { fromCustomer: false, text: "Como posso ajudar?" },
      { fromCustomer: true, text: "  " },
      { fromCustomer: true, text: "boleto" }
    ])).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "Como posso ajudar?" },
      { role: "user", content: "boleto" }
    ]);
    const { createMessage, calls } = fakeClaude([]);
    const result = await runN1Turn({ config, conversation: [{ fromCustomer: true, text: "oi" }, { fromCustomer: false, text: "Olá!" }], customer, tools: tools().impl, createMessage });
    expect(calls).toHaveLength(0);
    expect(result.reply).toBe("");
  });
});
