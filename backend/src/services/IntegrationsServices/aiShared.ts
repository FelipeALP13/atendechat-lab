import crypto from "crypto";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Op } from "sequelize";
import Message from "../../models/Message";
import { decryptSecret } from "../../helpers/secretBox";

/**
 * Peças comuns dos robôs de IA (OpenAI, Gemini e o agente N1).
 *
 * Antes cada atendimento criava e guardava o seu próprio cliente de IA numa lista que nunca
 * era limpa (vazamento de memória) e que continuava usando a chave antiga depois de trocada.
 * Agora o cliente é reaproveitado por chave, com limite de tamanho.
 */

const MAX_CLIENTS = 50;
const clients = new Map<string, unknown>();

const fingerprint = (provider: string, apiKey: string) =>
  `${provider}:${crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16)}`;

function cached<T>(provider: string, apiKey: string, build: () => T): T {
  const key = fingerprint(provider, apiKey);
  const existing = clients.get(key) as T | undefined;
  if (existing) {
    // Mais recente no fim (o mais antigo sai primeiro quando passa do limite).
    clients.delete(key);
    clients.set(key, existing);
    return existing;
  }
  const created = build();
  clients.set(key, created);
  if (clients.size > MAX_CLIENTS) clients.delete(clients.keys().next().value as string);
  return created;
}

/** Cliente OpenAI para a chave salva (criptografada ou legada). */
export const openAiClient = (storedKey: string) => {
  const apiKey = decryptSecret(storedKey);
  return cached("openai", apiKey, () => new OpenAI({ apiKey }));
};

/** Cliente Anthropic (Claude) para a chave salva (criptografada). */
export const anthropicClient = (storedKey: string) => {
  const apiKey = decryptSecret(storedKey);
  return cached("anthropic", apiKey, () => new Anthropic({ apiKey }));
};

/** Cliente Gemini para a chave salva (criptografada ou legada). */
export const geminiClient = (storedKey: string) => {
  const apiKey = decryptSecret(storedKey);
  return cached("gemini", apiKey, () => new GoogleGenerativeAI(apiKey));
};

// WhatsApp normal (Baileys) grava "conversation"/"extendedTextMessage"; a API oficial grava o texto do cliente como "text".
const TEXT_TYPES = ["conversation", "extendedTextMessage", "text"];

/**
 * As últimas `limit` mensagens de texto do atendimento, em ordem (mais antiga primeiro).
 * Antes a busca pegava as PRIMEIRAS mensagens (ordem crescente + limite): em conversas longas
 * a IA respondia sem ver o que o cliente tinha acabado de dizer.
 * `excludeWid` tira a mensagem que acabou de chegar, que já vai separada no pedido à IA.
 */
export async function recentTextMessages(ticketId: number, limit: number, excludeWid?: string | null): Promise<Message[]> {
  // Notas privadas da equipe (isPrivate) também são texto, mas não fazem parte da conversa com o cliente.
  const where: Record<string, unknown> = { ticketId, mediaType: { [Op.in]: TEXT_TYPES }, isPrivate: { [Op.not]: true } };
  if (excludeWid) where.wid = { [Op.ne]: excludeWid };
  const rows = await Message.findAll({
    where,
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit: limit > 0 ? Math.min(limit, 100) : 20
  });
  return rows.reverse();
}

/** Primeiro nome para tratar o cliente, mantendo acentos ("José", "Márcia"). */
export function customerFirstName(name: string | null | undefined, fallback = "Amigo(a)"): string {
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  const clean = first.replace(/[^\p{L}\p{N}'-]/gu, "").slice(0, 40);
  return clean || fallback;
}

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Pedido explícito para falar com uma pessoa. Só frases claras: antes "não entendi" ou
 * "isso não funciona" já transferiam o cliente, mesmo no meio de uma explicação.
 */
const TRANSFER_PHRASES = [
  "falar com atendente", "falar com um atendente", "quero um atendente", "atendente humano",
  "pessoa real", "sair do bot", "parar bot", "atendimento humano", "falar com alguem",
  "falar com uma pessoa", "quero falar com uma pessoa", "me transfere", "me transfira",
  "atendente por favor", "falar com humano"
];

export function asksForHuman(message: string): boolean {
  const text = fold(message || "");
  return TRANSFER_PHRASES.some(phrase => text.includes(phrase));
}

/** Mensagem que o cliente vê quando a IA falha (sem detalhes técnicos). */
export const AI_FAILURE_MESSAGE = "Desculpe, não consegui responder agora. Já avisei a equipe e alguém vai continuar o seu atendimento.";
