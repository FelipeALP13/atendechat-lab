/**
 * Núcleo do módulo Site, usado pelo servidor e pela tela.
 * Sem dependências: textos padrão, cor da marca com contraste e links de contato.
 */

export interface TextDef { key: string; group: string; label: string; def: string; max?: number }

const T = (key: string, group: string, label: string, def: string, max = 200): TextDef => ({ key, group, label, def, max });

/** Todo texto do site/chat nasce com uma versão pronta. Vazio = usa o padrão. */
export const TEXTS: TextDef[] = [
  T("chat.launcher", "Chat · Botão", "Rótulo do botão flutuante", "Falar com o suporte", 40),
  T("chat.title", "Chat · Cabeçalho", "Título", "Suporte", 40),
  T("chat.subtitle", "Chat · Cabeçalho", "Subtítulo", "Assistente virtual · responde na hora", 80),
  T("chat.aiBadge", "Chat · Cabeçalho", "Selo de assistente virtual", "Assistente virtual", 30),
  T("chat.welcome", "Chat · Conversa", "Primeira mensagem", "Oi! Eu sou {nome}, assistente virtual do suporte. Em que posso ajudar?", 300),
  T("chat.placeholder", "Chat · Conversa", "Campo de mensagem", "Escreva sua dúvida", 60),
  T("chat.send", "Chat · Conversa", "Botão enviar", "Enviar", 20),
  T("chat.typing", "Chat · Conversa", "Digitando", "digitando…", 30),
  T("chat.error", "Chat · Conversa", "Falha ao enviar", "Não consegui enviar agora. Tente de novo em instantes.", 120),
  T("chat.limit", "Chat · Conversa", "Limite de mensagens", "Você enviou muitas mensagens seguidas. Aguarde um pouco para continuar.", 160),
  T("chat.closed", "Chat · Conversa", "Chat desligado", "O chat está indisponível no momento.", 120),
  T("chat.offHours", "Chat · Equipe", "Fora do horário da equipe", "Nossa equipe atende {horario}. Deixe seu contato e retornamos assim que abrirmos.", 200),
  T("chat.handoffTitle", "Chat · Equipe", "Título do formulário de contato", "Vamos chamar uma pessoa da equipe", 80),
  T("chat.handoffName", "Chat · Equipe", "Campo nome", "Seu nome", 40),
  T("chat.handoffContact", "Chat · Equipe", "Campo e-mail ou WhatsApp", "E-mail ou WhatsApp com DDD", 60),
  T("chat.handoffSubmit", "Chat · Equipe", "Botão do formulário", "Pedir retorno", 30),
  T("chat.handoffThanks", "Chat · Equipe", "Agradecimento", "Pronto! Nossa equipe vai falar com você.", 120),
  T("chat.handoffInvalid", "Chat · Equipe", "Contato inválido", "Informe um e-mail ou um WhatsApp com DDD.", 100),
  T("chat.privacy", "Chat · Rodapé", "Aviso de privacidade", "Não envie senhas nem dados de cartão por aqui.", 120),
  T("help.title", "Central de ajuda", "Título da página", "Como podemos ajudar?", 80),
  T("help.search", "Central de ajuda", "Campo de busca", "Busque por um assunto", 60),
  T("help.empty", "Central de ajuda", "Nada encontrado", "Não achamos nada com esse termo. Pergunte ao assistente.", 120),
  T("help.cta", "Central de ajuda", "Botão para o chat", "Perguntar ao assistente", 40),
];
export const TEXT_BY_KEY = new Map(TEXTS.map((t) => [t.key, t]));

export interface Schedule { mode: "always" | "hours"; start: string; end: string; days: number[] }
export interface SiteConfig {
  brand: { name: string; color: string; logoUrl: string; position: "right" | "left"; agentName: string };
  seo: { title: string; description: string };
  contact: { whatsapp: string; email: string; phone: string; termsUrl: string; privacyUrl: string };
  chat: { enabled: boolean; origins: string[]; dailyLimit: number | null; schedule: Schedule };
  texts: Record<string, string>;
}

export const defaultSite = (): SiteConfig => ({
  brand: { name: "Minha empresa", color: "#3943ce", logoUrl: "", position: "right", agentName: "Júlia" },
  seo: { title: "", description: "" },
  contact: { whatsapp: "", email: "", phone: "", termsUrl: "", privacyUrl: "" },
  chat: { enabled: true, origins: [], dailyLimit: 500, schedule: { mode: "always", start: "08:00", end: "18:00", days: [1, 2, 3, 4, 5] } },
  texts: {},
});

/** Texto final: o salvo, ou o padrão. {nome} e {horario} são trocados. */
export function resolveText(site: SiteConfig, key: string, vars: Record<string, string> = {}): string {
  const d = TEXT_BY_KEY.get(key);
  if (!d) throw new Error(`texto desconhecido: ${key}`);
  const raw = site.texts[key]?.trim() || d.def;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

// ---------- cor ----------
const hex = (s: string) => /^#?[0-9a-f]{6}$/i.test(s.trim());
const rgb = (h: string): [number, number, number] => {
  const v = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
};
const toHex = (c: number[]) => "#" + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const luminance = (h: string) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Aceita qualquer cor e a escurece até o texto branco ter contraste 4,5:1. O matiz continua o do usuário. */
export function brandColor(input: string): { color: string; adjusted: boolean } {
  if (!hex(input)) throw new Error("cor inválida, use o formato #RRGGBB");
  const start = "#" + input.trim().replace("#", "").toLowerCase();
  let c: number[] = rgb(start);
  let cur = toHex(c);
  for (let i = 0; i < 60 && contrast(cur, "#ffffff") < 4.5; i++) {
    c = c.map((x) => x * 0.95);
    cur = toHex(c);
  }
  return { color: cur, adjusted: cur !== start };
}

/** Derivados da cor: fundo suave e texto sobre a marca. */
export function palette(color: string) {
  const [r, g, b] = rgb(color);
  return { primary: color, onPrimary: "#ffffff", soft: toHex([r + (255 - r) * 0.9, g + (255 - g) * 0.9, b + (255 - b) * 0.9]) };
}

// ---------- contato ----------
/** Aceita 10 a 13 dígitos; sem DDI, assume Brasil. */
export function whatsappLink(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length < 10 || d.length > 13) return null;
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}`;
}
export const isEmail = (s: string) => /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const isContact = (s: string) => isEmail(s) || whatsappLink(s) !== null;

export const DAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function scheduleLabel(s: Schedule): string {
  if (s.mode === "always") return "a qualquer hora";
  const days = [...s.days].sort();
  const range = days.length > 1 && days.every((d, i) => i === 0 || d === days[i - 1] + 1) ? `${DAYS[days[0]]} a ${DAYS[days[days.length - 1]]}` : days.map((d) => DAYS[d]).join(", ");
  return `${range}, das ${s.start} às ${s.end}`;
}
/** `at` em horário de Brasília (UTC-3, sem horário de verão desde 2019). */
export function isOpen(s: Schedule, at: number): boolean {
  if (s.mode === "always") return true;
  const d = new Date(at - 3 * 3600_000);
  const min = d.getUTCHours() * 60 + d.getUTCMinutes();
  const [h1, m1] = s.start.split(":").map(Number);
  const [h2, m2] = s.end.split(":").map(Number);
  return s.days.includes(d.getUTCDay()) && min >= h1 * 60 + m1 && min < h2 * 60 + m2;
}

/** Valida e normaliza uma configuração vinda de fora. Lança erro com a causa. */
export function sanitizeSite(raw: unknown, base: SiteConfig = defaultSite()): { site: SiteConfig; notes: string[] } {
  const r = (raw ?? {}) as Partial<Record<keyof SiteConfig, Record<string, unknown>>>;
  const notes: string[] = [];
  const s: SiteConfig = JSON.parse(JSON.stringify(base));
  const str = (v: unknown, max: number, what: string) => {
    const t = String(v ?? "").trim();
    if (t.length > max) throw new Error(`${what}: no máximo ${max} caracteres`);
    return t;
  };
  const url = (v: unknown, what: string) => {
    const t = str(v, 300, what);
    if (t && !/^https?:\/\/[^\s]+$/i.test(t)) throw new Error(`${what}: use um endereço que comece com http:// ou https://`);
    return t;
  };
  if (r.brand) {
    const b = r.brand;
    if (b.name !== undefined) s.brand.name = str(b.name, 60, "Nome") || s.brand.name;
    if (b.agentName !== undefined) s.brand.agentName = str(b.agentName, 30, "Nome do agente") || s.brand.agentName;
    if (b.logoUrl !== undefined) s.brand.logoUrl = url(b.logoUrl, "Logotipo");
    if (b.position !== undefined) s.brand.position = b.position === "left" ? "left" : "right";
    if (b.color !== undefined) {
      const c = brandColor(String(b.color));
      s.brand.color = c.color;
      if (c.adjusted) notes.push(`A cor foi escurecida para ${c.color} para o texto branco ficar legível.`);
    }
  }
  if (r.seo) {
    if (r.seo.title !== undefined) s.seo.title = str(r.seo.title, 70, "Título da página");
    if (r.seo.description !== undefined) s.seo.description = str(r.seo.description, 400, "Descrição");
  }
  if (r.contact) {
    const c = r.contact;
    if (c.whatsapp !== undefined) {
      const w = str(c.whatsapp, 30, "WhatsApp");
      if (w && !whatsappLink(w)) throw new Error("WhatsApp: informe DDD e número, com 10 a 13 dígitos");
      s.contact.whatsapp = w;
    }
    if (c.email !== undefined) {
      const e = str(c.email, 120, "E-mail");
      if (e && !isEmail(e)) throw new Error("E-mail inválido");
      s.contact.email = e;
    }
    if (c.phone !== undefined) s.contact.phone = str(c.phone, 30, "Telefone");
    if (c.termsUrl !== undefined) s.contact.termsUrl = url(c.termsUrl, "Termos de uso");
    if (c.privacyUrl !== undefined) s.contact.privacyUrl = url(c.privacyUrl, "Privacidade");
  }
  if (r.chat) {
    const c = r.chat;
    if (c.enabled !== undefined) s.chat.enabled = Boolean(c.enabled);
    if (c.origins !== undefined) {
      if (!Array.isArray(c.origins)) throw new Error("Sites permitidos: envie uma lista");
      s.chat.origins = [...new Set(c.origins.map((o) => {
        const t = String(o).trim().replace(/\/$/, "");
        if (!/^https?:\/\/[^\s/]+$/i.test(t)) throw new Error(`Site permitido inválido: ${t} (use https://exemplo.com.br, sem caminho)`);
        return t.toLowerCase();
      }))].slice(0, 20);
    }
    if (c.dailyLimit !== undefined) {
      if (c.dailyLimit === null || c.dailyLimit === "") s.chat.dailyLimit = null;
      else {
        const n = Number(c.dailyLimit);
        if (!Number.isInteger(n) || n < 1 || n > 100000) throw new Error("Limite diário: número inteiro entre 1 e 100000");
        s.chat.dailyLimit = n;
      }
    }
    if (c.schedule !== undefined) {
      const sc = c.schedule as Partial<Schedule>;
      const t = /^([01]\d|2[0-3]):[0-5]\d$/;
      const next: Schedule = { mode: sc.mode === "hours" ? "hours" : "always", start: String(sc.start ?? s.chat.schedule.start), end: String(sc.end ?? s.chat.schedule.end), days: Array.isArray(sc.days) ? [...new Set(sc.days.map(Number))].filter((d) => d >= 0 && d <= 6) : s.chat.schedule.days };
      if (next.mode === "hours") {
        if (!t.test(next.start) || !t.test(next.end)) throw new Error("Horário: use o formato HH:MM");
        if (next.start >= next.end) throw new Error("Horário: o início precisa ser antes do fim");
        if (!next.days.length) throw new Error("Horário: escolha ao menos um dia");
      }
      s.chat.schedule = next;
    }
  }
  if (r.texts) {
    for (const [k, v] of Object.entries(r.texts)) {
      const d = TEXT_BY_KEY.get(k);
      if (!d) throw new Error(`texto desconhecido: ${k}`);
      const t = String(v ?? "").trim();
      if (!t || t === d.def) delete s.texts[k];
      else if (t.length > (d.max ?? 200)) throw new Error(`${d.label}: no máximo ${d.max} caracteres`);
      else s.texts[k] = t;
    }
  }
  return { site: s, notes };
}
