/**
 * Resultados do agente contra um Postgres de verdade.
 * N1_TEST_DB=postgres://postgres@localhost:5432/n1test npx jest src/services/ResultsService
 */
import { Pool } from "pg";
import { saveConfig } from "../../AgentN1/config";
import { makeStore, Store } from "../../AgentN1/store";
import { results } from "../index";

const url = process.env.N1_TEST_DB;
const d = url ? describe : describe.skip;

d("Resultados (Postgres)", () => {
  let pool: Pool;
  let A: Store;
  let B: Store;
  const ids: number[] = [];
  const now = Date.parse("2026-11-09T15:00:00Z");
  const DAY = 86400000;

  const audit = (s: Store, conversation: string, decision: string, cost: number, at: number) =>
    s.run(
      `INSERT INTO "N1Audit" ("companyId", at, conversation, question, decision, reason, confidence, sources, cost)
       VALUES ($1,$2,$3,'q',$4,'r',90,'[]',$5)`,
      [s.companyId, at, conversation, decision, cost]
    );
  const event = (s: Store, session: string, event: string, at: number, detail?: string) =>
    s.run(`INSERT INTO "SiteEvents" ("companyId", at, session, event, detail) VALUES ($1,$2,$3,$4,$5)`, [
      s.companyId,
      at,
      session,
      event,
      detail || null
    ]);

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    const run = (sql: string, p?: unknown[]) => pool.query(sql, p as any[]).then(r => r.rows);
    for (const n of ["Resultados A", "Resultados B"]) {
      const r = await run(`INSERT INTO "Companies" (name, "createdAt", "updatedAt") VALUES ($1, now(), now()) RETURNING id`, [n]);
      ids.push(r[0].id);
    }
    A = makeStore(ids[0], run);
    B = makeStore(ids[1], run);
    await saveConfig(A, { fx: 5 });

    // WhatsApp: uma conversa resolvida em duas mensagens, uma transferida.
    await audit(A, "wa:1", "answer", 0.01, now - DAY);
    await audit(A, "wa:1", "answer", 0.01, now - DAY);
    await audit(A, "wa:2", "answer", 0.01, now - DAY);
    await audit(A, "wa:2", "handoff", 0, now - DAY);
    // Site: uma resolvida (campanha black), uma com rascunho (sem campanha).
    await audit(A, "site:sess-aaaa1111", "answer", 0.02, now);
    await audit(A, "site:sess-bbbb2222", "draft", 0.02, now);
    await event(A, "sess-aaaa1111", "open", now, "black-friday");
    await event(A, "sess-bbbb2222", "open", now);
    await event(A, "sess-aaaa1111", "lead", now);
    // Fora da janela de 7 dias.
    await audit(A, "wa:velha", "answer", 1, now - 40 * DAY);
    await A.run(
      `INSERT INTO "N1Proposals" ("companyId", question, times, status, "createdAt", "lastAt") VALUES ($1,'como emito a nota',4,'pending',$2,$2)`,
      [A.companyId, now]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM "Companies" WHERE id = ANY($1)`, [ids]);
    await pool.end();
  });

  it("conta conversas, não mensagens, e separa resolvidas de transferidas", async () => {
    const r = await results(A, 7, now);
    expect(r.totals.conversations).toBe(4);
    expect(r.totals.resolved).toBe(2);
    expect(r.totals.escalated).toBe(2);
    expect(r.totals.resolvedPct).toBe(50);
  });

  it("rascunho conta como transferida: ainda precisa de uma pessoa", async () => {
    const r = await results(A, 7, now);
    expect(r.channels.site.escalated).toBe(1);
    expect(r.decisions.draft).toBe(1);
  });

  it("custo em reais usa a cotação da configuração e o custo por conversa", async () => {
    const r = await results(A, 7, now);
    expect(r.fx).toBe(5);
    expect(r.totals.costUsd).toBeCloseTo(0.07, 4);
    expect(r.totals.costBrl).toBeCloseTo(0.35, 2);
    expect(r.totals.costPerConversationBrl).toBeCloseTo(0.09, 2);
    expect(r.totals.costPerResolvedBrl).toBeCloseTo(0.18, 2);
  });

  it("separa site e WhatsApp", async () => {
    const r = await results(A, 7, now);
    expect(r.channels.whatsapp).toEqual({ conversations: 2, resolved: 1, escalated: 1, costBrl: 0.15 });
    expect(r.channels.site.conversations).toBe(2);
    expect(r.channels.site.resolved).toBe(1);
  });

  it("agrupa por campanha a partir do utm guardado na abertura do chat", async () => {
    const r = await results(A, 7, now);
    const black = r.campaigns.filter(c => c.campaign === "black-friday")[0];
    expect(black).toEqual({ campaign: "black-friday", sessions: 1, conversations: 1, escalated: 0, leads: 1, costBrl: 0.1 });
    expect(r.campaigns.filter(c => c.campaign === "sem campanha")[0].escalated).toBe(1);
  });

  it("série diária em dias de Brasília", async () => {
    const r = await results(A, 7, now);
    expect(r.daily).toHaveLength(2);
    expect(r.daily[0].conversations).toBe(2);
    expect(r.daily[1].conversations).toBe(2);
    expect(r.daily[0].day).toBeLessThan(r.daily[1].day);
  });

  it("o que está fora do período não entra, e a janela maior inclui", async () => {
    expect((await results(A, 7, now)).totals.conversations).toBe(4);
    expect((await results(A, 90, now)).totals.conversations).toBe(5);
  });

  it("as cinco maiores lacunas aparecem para quem lê o painel", async () => {
    const r = await results(A, 7, now);
    expect(r.topGaps[0].question).toBe("como emito a nota");
    expect(r.topGaps[0].times).toBe(4);
  });

  it("empresa sem movimento não herda números da outra", async () => {
    const r = await results(B, 30, now);
    expect(r.totals.conversations).toBe(0);
    expect(r.totals.resolvedPct).toBe(0);
    expect(r.totals.costPerConversationBrl).toBe(0);
    expect(r.campaigns).toHaveLength(0);
    expect(r.daily).toHaveLength(0);
  });
});
