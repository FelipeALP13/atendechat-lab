/** O que o cliente recebe no WhatsApp e quando o ticket vai para a equipe. Não precisa de banco. */
import { AgentReply } from "../agent";
import { CHECKING_TEXT, planWhatsappReply, UNAVAILABLE_TEXT } from "../whatsappPlan";

const reply = (over: Partial<AgentReply>): AgentReply =>
  ({ decision: "answer", reason: "grounded", confidence: 90, sources: [], messages: [{ text: "oi", delayMs: 500 }], ...over } as AgentReply);

describe("Plano de resposta no WhatsApp", () => {
  it("sem agente disponível, avisa o cliente e chama a equipe", () => {
    const p = planWhatsappReply(null);
    expect(p.messages[0].text).toBe(UNAVAILABLE_TEXT);
    expect(p.handoff.reason).toBe("low_confidence");
    expect(p.handoff.note).toMatch(/indisponível/);
  });

  it("resposta normal vai ao cliente e o ticket continua com o agente", () => {
    const p = planWhatsappReply(reply({ messages: [{ text: "primeiro", delayMs: 300 }, { text: "segundo", delayMs: 800 }] }));
    expect(p.messages.map(m => m.text)).toEqual(["primeiro", "segundo"]);
    expect(p.handoff).toBeNull();
  });

  it("rascunho não vai ao cliente: ele recebe um aviso e a equipe recebe o texto", () => {
    const p = planWhatsappReply(reply({ decision: "draft", reason: "draft", messages: [], draft: "Resposta sugerida ao N2", confidence: 65 }));
    expect(p.messages).toHaveLength(1);
    expect(p.messages[0].text).toBe(CHECKING_TEXT);
    expect(p.handoff.reason).toBe("draft");
    expect(p.handoff.note).toContain("Resposta sugerida ao N2");
    expect(p.handoff.note).not.toBe(CHECKING_TEXT);
  });

  it("transferência leva a mensagem ao cliente e o resumo à equipe", () => {
    const p = planWhatsappReply(
      reply({
        decision: "handoff",
        reason: "asks_human",
        messages: [{ text: "Já peço para alguém falar com você.", delayMs: 400 }],
        handoff: { reason: "asks_human", question: "quero falar com uma pessoa", tried: ["/faturamento"], history: ["oi"] }
      })
    );
    expect(p.messages[0].text).toMatch(/alguém/);
    expect(p.handoff.reason).toBe("asks_human");
    expect(p.handoff.note).toContain("quero falar com uma pessoa");
    expect(p.handoff.note).toContain("/faturamento");
  });

  it("recusa e 'sou uma IA' respondem sem chamar a equipe", () => {
    for (const decision of ["refuse", "truth"] as const) {
      const p = planWhatsappReply(reply({ decision, reason: "credentials", messages: [{ text: "não envie senha", delayMs: 300 }] }));
      expect(p.handoff).toBeNull();
      expect(p.messages).toHaveLength(1);
    }
  });

  it("agente sem nada a dizer não deixa o cliente no vazio", () => {
    const p = planWhatsappReply(reply({ decision: "handoff", reason: "no_source", messages: [] }));
    expect(p.messages[0].text).toBe(UNAVAILABLE_TEXT);
    expect(p.handoff.reason).toBe("no_source");
  });
});
