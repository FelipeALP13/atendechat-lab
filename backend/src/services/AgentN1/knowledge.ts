import { createHash } from "crypto";
import { chunkPage } from "./chunk";
import { one, Store } from "./store";
import { queryStems, stemText } from "./text";

export interface Hit {
  id: number;
  kind: "gitbook" | "approved";
  path: string;
  text: string;
  coverage: number;
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

async function indexChunk(s: Store, kind: string, path: string, heading: string, text: string, ref: string | null) {
  await s.run(`INSERT INTO "N1Chunks" ("companyId", kind, path, heading, text, stems, ref) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [s.companyId, kind, path, heading, text, stemText(text), ref]);
}

/** Grava ou atualiza uma página do GitBook. Só reindexa quando o conteúdo mudou. */
export async function upsertPage(s: Store, path: string, title: string, body: string): Promise<"new" | "changed" | "same"> {
  const h = hash(body);
  const cur = await one<{ hash: string }>(s, `SELECT hash FROM "N1Pages" WHERE "companyId" = $1 AND path = $2`, [s.companyId, path]);
  if (cur && cur.hash === h) return "same";
  await s.run(`DELETE FROM "N1Chunks" WHERE "companyId" = $1 AND kind = 'gitbook' AND path = $2`, [s.companyId, path]);
  await s.run(
    `INSERT INTO "N1Pages" ("companyId", path, title, hash, body, "fetchedAt") VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT ("companyId", path) DO UPDATE SET title = EXCLUDED.title, hash = EXCLUDED.hash, body = EXCLUDED.body, "fetchedAt" = EXCLUDED."fetchedAt"`,
    [s.companyId, path, title, h, body, Date.now()],
  );
  for (const c of chunkPage(path, title, body)) await indexChunk(s, "gitbook", path, c.heading, c.text, null);
  if (cur) {
    // Respostas aprovadas apoiadas nesta página voltam para revisão e saem da busca.
    await s.run(`UPDATE "N1Approved" SET status = 'review' WHERE "companyId" = $1 AND "basedOnPage" = $2 AND status = 'active'`, [s.companyId, path]);
    await s.run(
      `UPDATE "N1Chunks" SET active = FALSE WHERE "companyId" = $1 AND kind = 'approved' AND ref IN (SELECT id::text FROM "N1Approved" WHERE "companyId" = $1 AND status = 'review')`,
      [s.companyId],
    );
  }
  return cur ? "changed" : "new";
}

export async function removePage(s: Store, path: string) {
  await s.run(`DELETE FROM "N1Chunks" WHERE "companyId" = $1 AND kind = 'gitbook' AND path = $2`, [s.companyId, path]);
  await s.run(`DELETE FROM "N1Pages" WHERE "companyId" = $1 AND path = $2`, [s.companyId, path]);
}

export const indexApproved = (s: Store, id: number, question: string, body: string, page: string | null) =>
  indexChunk(s, "approved", page || "aprovado", question, `${page || "aprovado"} > ${question}\n${body}`, String(id));

export const deactivateApproved = (s: Store, id: number) =>
  s.run(`UPDATE "N1Chunks" SET active = FALSE WHERE "companyId" = $1 AND kind = 'approved' AND ref = $2`, [s.companyId, String(id)]);

/**
 * Busca por termos (radicais) com índice de texto do Postgres. A confiança é a cobertura da pergunta pelo trecho;
 * termo que não existe em nenhum trecho da base pesa pouco (costuma ser verbo solto ou palavra do cliente).
 */
export async function search(s: Store, question: string, k = 4): Promise<Hit[]> {
  const terms = queryStems(question);
  if (!terms.length) return [];
  const tsq = terms.join(" | ");
  const rows = await s.run(
    `SELECT id, kind, path, text, stems FROM "N1Chunks"
     WHERE "companyId" = $1 AND active AND tsv @@ to_tsquery('simple', $2)
     ORDER BY ts_rank(tsv, to_tsquery('simple', $2)) DESC LIMIT $3`,
    [s.companyId, tsq, k * 3],
  );
  const known = new Set<string>();
  if (rows.length) {
    const present = await s.run(
      `SELECT t FROM unnest($2::text[]) AS t WHERE EXISTS (SELECT 1 FROM "N1Chunks" WHERE "companyId" = $1 AND active AND tsv @@ to_tsquery('simple', t))`,
      [s.companyId, terms],
    );
    for (const r of present) known.add(r.t);
  }
  const weight = (t: string) => (known.has(t) ? 1 : 0.35);
  const total = terms.reduce((a, t) => a + weight(t), 0);
  const hits = rows.map((r) => {
    const set = new Set<string>(String(r.stems).split(" "));
    const found = terms.filter((t) => set.has(t)).reduce((a, t) => a + weight(t), 0);
    return { id: r.id, kind: r.kind, path: r.path, text: r.text, coverage: found / total } as Hit;
  });
  hits.sort((a, b) => b.coverage - a.coverage);
  return hits.slice(0, k);
}

export async function stats(s: Store) {
  const pages = await one(s, `SELECT COUNT(*)::int n, COALESCE(MAX("fetchedAt"), 0)::bigint last FROM "N1Pages" WHERE "companyId" = $1`, [s.companyId]);
  const approved = await one(s, `SELECT COUNT(*)::int n FROM "N1Approved" WHERE "companyId" = $1 AND status = 'active'`, [s.companyId]);
  return { pages: pages.n, lastSyncAt: Number(pages.last) || null, approved: approved.n };
}
