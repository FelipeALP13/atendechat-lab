/**
 * Cliente da API de integração do Portal da Equipe (Base de conhecimento e chamados).
 * Servidor para servidor, com a chave de integração criada no Portal (Administração → Agente N1).
 */

export type PortalArticle = { id: number; title: string; body: string; tags: string; updatedAt: string };
export type PortalTicketInput = {
  title: string;
  description: string;
  urgency: "low" | "normal" | "high" | "critical";
  externalId: string;
  customerName?: string;
  customerPhone?: string;
  company?: string;
  conversationUrl?: string | null;
};

export class PortalError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const TIMEOUT_MS = 10000;

/** Endereço base do Portal sem barra no fim; só http(s). */
export function normalizePortalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function createPortalClient(baseUrl: string, key: string, fetchImpl: typeof fetch = fetch) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) }
      });
      const data = (await response.json().catch(() => ({}))) as T & { error?: string };
      if (!response.ok) throw new PortalError(data?.error || `Portal respondeu ${response.status}`, response.status);
      return data;
    } catch (error) {
      if (error instanceof PortalError) throw error;
      throw new PortalError(controller.signal.aborted ? "O Portal demorou para responder." : "Não foi possível falar com o Portal.", 0);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async searchKnowledge(query: string): Promise<PortalArticle[]> {
      const data = await request<{ articles: PortalArticle[] }>(`/api/integrations/atendechat?q=${encodeURIComponent(query.slice(0, 500))}`);
      return data.articles || [];
    },
    async createTicket(input: PortalTicketInput): Promise<{ id: number; code: string; duplicate: boolean }> {
      const data = await request<{ ticket: { id: number; code: string }; duplicate?: boolean }>("/api/integrations/atendechat", {
        method: "POST",
        body: JSON.stringify({ action: "createTicket", ...input })
      });
      return { ...data.ticket, duplicate: Boolean(data.duplicate) };
    }
  };
}

export type PortalClient = ReturnType<typeof createPortalClient>;
