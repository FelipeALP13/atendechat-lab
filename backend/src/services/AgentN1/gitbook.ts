import { removePage, upsertPage } from "./knowledge";
import { Store } from "./store";

export type Fetcher = (url: string) => Promise<string>;

export const defaultFetcher: Fetcher = async (url) => {
  const r = await fetch(url, { headers: { "user-agent": "AtendeChat-N1-indexer" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};

/** Lê o llms.txt do GitBook: linhas no formato "- [Título](url.md)". */
export function parseIndex(llms: string, base: string): { path: string; title: string; url: string }[] {
  const out: { path: string; title: string; url: string }[] = [];
  const root = base.endsWith("/") ? base : base + "/";
  const rootPath = new URL(root).pathname;
  for (const m of llms.matchAll(/\[([^\]]+)\]\(([^)\s]+?\.md)\)/g)) {
    const url = new URL(m[2], root).toString();
    let path = decodeURIComponent(new URL(url).pathname);
    if (path.startsWith(rootPath)) path = path.slice(rootPath.length);
    path = path.replace(/^\//, "").replace(/\.md$/, "");
    out.push({ path: path || "inicio", title: m[1], url });
  }
  return out;
}

export interface SyncResult { total: number; added: number; changed: number; same: number; removed: number; failed: string[] }

/** Só http(s) público: a fonte é configurada pelo cliente, então não pode apontar para a rede interna. */
export function assertPublicSource(base: string) {
  const u = new URL(base);
  if (u.protocol !== "https:") throw new Error("o endereço da documentação deve usar https");
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.includes(":")) throw new Error("endereço da documentação não permitido");
}

/** Sincroniza todas as páginas. Pode rodar todo dia: só o que mudou é reindexado. */
export async function syncGitbook(s: Store, base: string, fetcher: Fetcher = defaultFetcher, concurrency = 6): Promise<SyncResult> {
  const index = parseIndex(await fetcher(`${base.replace(/\/$/, "")}/llms.txt`), base);
  const res: SyncResult = { total: index.length, added: 0, changed: 0, same: 0, removed: 0, failed: [] };
  let i = 0;
  const worker = async () => {
    while (i < index.length) {
      const p = index[i++];
      try {
        const r = await upsertPage(s, p.path, p.title, await fetcher(p.url));
        if (r === "new") res.added++; else if (r === "changed") res.changed++; else res.same++;
      } catch { res.failed.push(p.path); }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  // Só remove páginas que sumiram do índice quando nenhuma falhou, para não apagar por erro de rede.
  if (!res.failed.length && index.length) {
    const keep = new Set(index.map((p) => p.path));
    for (const r of await s.run(`SELECT path FROM "N1Pages" WHERE "companyId" = $1`, [s.companyId])) {
      if (!keep.has(r.path)) { await removePage(s, r.path); res.removed++; }
    }
  }
  return res;
}
