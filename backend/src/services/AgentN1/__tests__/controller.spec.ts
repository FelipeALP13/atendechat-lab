/**
 * Camada HTTP do Agente N1 (controller) contra o banco real do sistema.
 * Precisa de DB_HOST, DB_PORT, DB_NAME, DB_USER e DB_PASS apontando para um banco migrado, e N1_TEST_DB.
 */
import sequelize from "../../../database";
import * as C from "../../../controllers/AgentN1Controller";
import { upsertPage } from "../knowledge";
import { n1Store } from "../Runtime";
import { PAGES } from "./fixtures/pages";

const d = process.env.N1_TEST_DB ? describe : describe.skip;

const call = async (fn: any, user: any, body: any = {}, params: any = {}, query: any = {}) => {
  let status = 200, payload: any;
  const res: any = { status(c: number) { status = c; return res; }, json(p: any) { payload = p; return res; } };
  try { await fn({ user, body, params, query }, res); } catch (e: any) { return { status: e.statusCode || 500, payload: { error: e.message } }; }
  return { status, payload };
};

d("Agente N1 (HTTP)", () => {
  let companyId: number, otherId: number;
  const admin = () => ({ id: 1, profile: "admin", companyId });
  const agent = () => ({ id: 1, profile: "user", companyId });

  beforeAll(async () => {
    const mk = async (n: string) => ((await sequelize.query(`INSERT INTO "Companies" (name, "createdAt", "updatedAt") VALUES ('${n}', now(), now()) RETURNING id`))[0] as any[])[0].id;
    companyId = await mk("N1 http A");
    otherId = await mk("N1 http B");
    await sequelize.query(`INSERT INTO "Users" (name, email, "passwordHash", profile, "companyId", "createdAt", "updatedAt") VALUES ('Ana N2', 'ana-n1@x.com', 'x', 'user', ${companyId}, now(), now())`).catch(() => undefined);
    for (const [p, v] of Object.entries(PAGES)) await upsertPage(n1Store(companyId), p, v.title, v.body);
  });
  afterAll(async () => {
    await sequelize.query(`DELETE FROM "Users" WHERE email = 'ana-n1@x.com'`);
    await sequelize.query(`DELETE FROM "Companies" WHERE id IN (${companyId}, ${otherId})`);
    await sequelize.close();
  });

  it("configuração: qualquer usuário lê; só administrador altera", async () => {
    const r = await call(C.getConfig, agent());
    expect(r.payload.config.name).toBe("Júlia");
    expect(r.payload.stats.pages).toBe(Object.keys(PAGES).length);
    expect((await call(C.putConfig, agent(), { name: "X" })).status).toBe(403);
    const ok = await call(C.putConfig, admin(), { name: "Bia", gitbookUrl: "https://docs.exemplo.io/x" });
    expect(ok.payload.config.name).toBe("Bia");
    expect((await call(C.putConfig, admin(), { gitbookUrl: "http://ruim" })).status).toBe(400);
    expect((await call(C.getConfig, { id: 1, profile: "admin", companyId: otherId })).payload.config.name).toBe("Júlia");
  });

  it("sincronizar recusa endereço interno e exige administrador", async () => {
    expect((await call(C.sync, agent())).status).toBe(403);
    await call(C.putConfig, admin(), { gitbookUrl: "https://localhost/doc" });
    const r = await call(C.sync, admin());
    expect(r.status).toBe(400);
    expect(r.payload.error).toMatch(/não permitido/);
  });

  it("lacunas: N2 responde, administrador aprova, outra empresa não enxerga", async () => {
    const q = "Como emito certificado digital de assinatura para o contador?";
    const a = await call(C.answer, agent(), { question: q, answer: "Em Cadastros > Certificados, clique em Emitir." });
    expect(a.status).toBe(201);
    const list = await call(C.proposals, agent(), {}, {}, {});
    expect(list.payload).toHaveLength(1);
    expect((await call(C.proposals, { id: 1, profile: "admin", companyId: otherId })).payload).toHaveLength(0);
    expect((await call(C.approveProposal, agent(), {}, { id: String(a.payload.id) })).status).toBe(403);
    expect((await call(C.approveProposal, admin(), {}, { id: String(a.payload.id) })).status).toBe(200);
    expect((await call(C.approveProposal, admin(), {}, { id: String(a.payload.id) })).status).toBe(400);
    const ap = await call(C.approvedList, agent());
    expect(ap.payload[0]).toMatchObject({ question: q, status: "active" });
    expect((await call(C.revoke, admin(), {}, { id: String(ap.payload[0].id) })).status).toBe(200);
  });

  it("consumo e auditoria", async () => {
    const u = await call(C.usage, agent());
    expect(u.payload).toMatchObject({ cap: 300, fx: 5.5 });
    expect(Array.isArray((await call(C.audit, agent())).payload)).toBe(true);
  });
});
