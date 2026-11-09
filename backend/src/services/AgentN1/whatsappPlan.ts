import { AgentReply, Outgoing } from "./agent";
import { handoffNote } from "./Runtime";

/** O que o atendimento no WhatsApp deve fazer com a resposta do agente. */
export interface N1Plan {
  /** Mensagens que vão para o cliente, na ordem. */
  messages: Outgoing[];
  /** Quando preenchido, o ticket vai para a fila do N2 com esta nota interna. */
  handoff: { reason: string; note: string } | null;
}

export const UNAVAILABLE_TEXT = "Vou chamar uma pessoa da equipe para te atender agora.";
export const CHECKING_TEXT = "Um instante, vou confirmar essa informação para não te passar nada errado.";
export const UNAVAILABLE_NOTE =
  "🤖 Agente N1 indisponível neste momento (sem chave do modelo ou erro de comunicação). Atenda normalmente.";

/**
 * Decide o que o cliente recebe e se o ticket vai para a equipe. O cliente nunca fica sem resposta:
 * sem agente ou sem certeza, ele é avisado antes da transferência.
 */
export function planWhatsappReply(reply: AgentReply | null): N1Plan {
  if (!reply) {
    return {
      messages: [{ text: UNAVAILABLE_TEXT, delayMs: 1200 }],
      handoff: { reason: "low_confidence", note: UNAVAILABLE_NOTE }
    };
  }

  // No rascunho o texto é para a equipe revisar, então não vai ao cliente.
  if (reply.decision === "draft") {
    return { messages: [{ text: CHECKING_TEXT, delayMs: 1500 }], handoff: { reason: "draft", note: handoffNote(reply) } };
  }

  const messages = reply.messages.length ? reply.messages : [{ text: UNAVAILABLE_TEXT, delayMs: 1200 }];
  if (reply.decision === "handoff") return { messages, handoff: { reason: reply.reason, note: handoffNote(reply) } };
  return { messages, handoff: null };
}
