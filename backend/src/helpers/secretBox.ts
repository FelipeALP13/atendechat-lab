import crypto from "crypto";
import logger from "../utils/logger";

/**
 * Criptografia das chaves de API guardadas no banco (OpenAI, Gemini, Anthropic...).
 *
 * Formato salvo: "enc:v1:<iv>:<tag>:<dados>" (base64), AES-256-GCM.
 * A chave mestra vem de SECRETS_KEY. Sem ela, usa um derivado do JWT_SECRET e avisa no log:
 * trocar o JWT_SECRET depois faria as chaves salvas deixarem de abrir.
 *
 * Valores antigos sem o prefixo continuam sendo lidos como estão (texto puro), para a troca
 * não quebrar nada; a migração 20261117000000 criptografa o que já estava salvo.
 */

const PREFIX = "enc:v1:";
let cachedKey: Buffer | null = null;
let warned = false;

function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const configured = process.env.SECRETS_KEY;
  if (configured && configured.length >= 32) {
    cachedKey = crypto.createHash("sha256").update(configured).digest();
    return cachedKey;
  }
  const fallback = process.env.JWT_SECRET;
  if (!fallback) throw new Error("SECRETS_KEY (ou JWT_SECRET) precisa estar definido para guardar chaves de API.");
  if (!warned) {
    warned = true;
    logger.warn("[secretBox] SECRETS_KEY não definido: usando derivado do JWT_SECRET. Defina SECRETS_KEY (32+ caracteres) para poder trocar o JWT_SECRET sem perder as chaves.");
  }
  cachedKey = crypto.createHash("sha256").update(`atendechat-secrets:${fallback}`).digest();
  return cachedKey;
}

export const isEncrypted = (value: unknown): value is string => typeof value === "string" && value.startsWith(PREFIX);

export function encryptSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return value === "" ? "" : null;
  if (isEncrypted(value)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

/** Abre o valor salvo. Texto sem o prefixo (legado) volta como está. */
export function decryptSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (!isEncrypted(value)) return value;
  const [iv, tag, data] = value.slice(PREFIX.length).split(":");
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    logger.error("[secretBox] Não foi possível abrir uma chave salva (SECRETS_KEY trocado?).");
    return "";
  }
}

/** Como a chave aparece na tela: só os 4 últimos caracteres. */
export function maskSecret(value: string | null | undefined): string {
  const plain = decryptSecret(value);
  if (!plain) return "";
  return `••••${plain.slice(-4)}`;
}

/** O formulário devolveu a máscara (ou nada): manter a chave que já estava salva. */
export const isMaskedOrEmpty = (value: unknown) => typeof value !== "string" || value.trim() === "" || value.startsWith("••••");

/** Tira a chave de configurações de IA guardadas em JSON (ex.: ticket.dataWebhook.settings) antes de ir para a tela. */
export function redactAiSettings<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  const data = value as unknown as Record<string, unknown>;
  const settings = data.settings as Record<string, unknown> | undefined;
  if (!settings || typeof settings !== "object" || !("apiKey" in settings)) return value;
  return { ...data, settings: { ...settings, apiKey: settings.apiKey ? "••••" : "" } } as unknown as T;
}
