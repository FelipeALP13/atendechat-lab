import { deactivateApproved, indexApproved } from "./knowledge";
import { one, Store } from "./store";
import { anonymize, jaccard } from "./text";

export interface Proposal {
  id: number; question: string; times: number; answeredBy: string | null; answer: string | null;
  suggestedPage: string | null; status: string; origins: string | null; lastAt: number | null; createdAt: number;
}

/** Acha uma proposta pendente igual ou muito parecida (mesmos termos, outra redação). */
export async function findPending(s: Store, question: string): Promise<{ id: number } | undefined> {
  const exact = await one<{ id: number }>(s, `SELECT id FROM "N1Proposals" WHERE "companyId" = $1 AND question = $2 AND status = 'pending'`, [s.companyId, question]);
  if (exact) return exact;
  const all = await s.run(`SELECT id, question FROM "N1Proposals" WHERE "companyId" = $1 AND status = 'pending' ORDER BY id DESC LIMIT 300`, [s.companyId]);
  let best: { id: number; s: number } | undefined;
  for (const r of all) {
    const sc = jaccard(question, r.question);
    if (sc >= 0.7 && (!best || sc > best.s)) best = { id: r.id, s: sc };
  }
  return best;
}

/** Registra uma lacuna. Repetida, ou só reescrita, soma 1 e guarda de onde veio (site, whatsapp…). */
export async function recordGap(s: Store, question: string, page: string | null, origin = "whatsapp", now = Date.now()) {
  const row = await findPending(s, question);
  if (row) {
    const cur = await one<{ origins: string | null }>(s, `SELECT origins FROM "N1Proposals" WHERE id = $1 AND "companyId" = $2`, [row.id, s.companyId]);
    const o = JSON.parse((cur && cur.origins) || "{}") as Record<string, number>;
    o[origin] = (o[origin] || 0) + 1;
    await s.run(`UPDATE "N1Proposals" SET times = times + 1, "lastAt" = $1, origins = $2 WHERE id = $3 AND "companyId" = $4`, [now, JSON.stringify(o), row.id, s.companyId]);
  } else {
    await s.run(
      `INSERT INTO "N1Proposals" ("companyId", question, times, status, "createdAt", "suggestedPage", "lastAt", origins) VALUES ($1,$2,1,'pending',$3,$4,$3,$5)`,
      [s.companyId, question, now, page, JSON.stringify({ [origin]: 1 })],
    );
  }
}

/** O N2 responde a uma lacuna. A pergunta repetida soma 1 em vez de criar outra proposta. */
export async function recordAnswer(s: Store, question: string, answeredBy: string, answer: string, page: string | null, now = Date.now()): Promise<number> {
  const row = await findPending(s, question);
  if (row) {
    await s.run(
      `UPDATE "N1Proposals" SET times = times + 1, "answeredBy" = $1, answer = $2, "suggestedPage" = COALESCE($3, "suggestedPage"), "lastAt" = $4 WHERE id = $5 AND "companyId" = $6`,
      [answeredBy, answer, page, now, row.id, s.companyId],
    );
    return row.id;
  }
  const r = await s.run(
    `INSERT INTO "N1Proposals" ("companyId", question, times, "answeredBy", answer, "suggestedPage", status, "createdAt", "lastAt") VALUES ($1,$2,1,$3,$4,$5,'pending',$6,$6) RETURNING id`,
    [s.companyId, question, answeredBy, answer, page, now],
  );
  return r[0].id;
}

export const listProposals = (s: Store, status = "pending"): Promise<Proposal[]> =>
  s.run(`SELECT id, question, times, "answeredBy", answer, "suggestedPage", status, origins, "lastAt"::float8 "lastAt", "createdAt"::float8 "createdAt" FROM "N1Proposals" WHERE "companyId" = $1 AND status = $2 ORDER BY times DESC, id`, [s.companyId, status]);

/** Só uma pessoa aprova. A resposta é anonimizada antes de entrar na base. */
export async function approve(s: Store, id: number, by: string, edited?: string): Promise<number> {
  const p = await one(s, `SELECT * FROM "N1Proposals" WHERE id = $1 AND "companyId" = $2 AND status = 'pending'`, [id, s.companyId]);
  if (!p) throw new Error("proposta inexistente ou já tratada");
  const body = anonymize(edited || p.answer || "");
  if (!body.trim()) throw new Error("proposta sem resposta do N2");
  const page = p.suggestedPage ? await one(s, `SELECT hash FROM "N1Pages" WHERE "companyId" = $1 AND path = $2`, [s.companyId, p.suggestedPage]) : undefined;
  const r = await s.run(
    `INSERT INTO "N1Approved" ("companyId", "proposalId", question, body, "approvedBy", "approvedAt", "basedOnPage", "basedOnHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [s.companyId, id, p.question, body, by, Date.now(), p.suggestedPage, page ? page.hash : null],
  );
  await indexApproved(s, r[0].id, anonymize(p.question), body, p.suggestedPage);
  await s.run(`UPDATE "N1Proposals" SET status = 'published' WHERE id = $1 AND "companyId" = $2`, [id, s.companyId]);
  return r[0].id;
}

export const reject = (s: Store, id: number) => s.run(`UPDATE "N1Proposals" SET status = 'rejected' WHERE id = $1 AND "companyId" = $2`, [id, s.companyId]);

export async function revokeApproved(s: Store, id: number) {
  await s.run(`UPDATE "N1Approved" SET status = 'revoked' WHERE id = $1 AND "companyId" = $2`, [id, s.companyId]);
  await deactivateApproved(s, id);
}
