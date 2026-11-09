/**
 * Camada HTTP do módulo Site (painel e chat público) contra o banco real do sistema.
 * Precisa de DB_HOST, DB_PORT, DB_NAME, DB_USER e DB_PASS apontando para um banco migrado, e N1_TEST_DB.
 */
import sequelize from "../../../database";
import * as A from "../../../controllers/SiteController";
import * as P from "../../../controllers/SitePublicController";
import { ensureRow, resetLimits, siteStore } from "../index";

const d = process.env.N1_TEST_DB ? describe : describe.skip;

const admin = (companyId: number) => ({ id: 1, profile: "admin", companyId });
const user = (companyId: number) => ({ id: 1, profile: "user", companyId });

const call = async (fn: any, req: any) => {
  let status = 200;
  let payload: any;
  let body: string | undefined;
  const headers: Record<string, string> = {};
  const res: any = {
    status(c: number) {
      status = c;
      return res;
    },
    json(p: any) {
      payload = p;
      return res;
    },
    send(p: any) {
      body = String(p);
      return res;
    },
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    end() {
      return res;
    }
  };
  try {
    await fn({ body: {}, params: {}, query: {}, headers: {}, socket: { remoteAddress: "10.0.0.1" }, ...req }, res);
  } catch (e: any) {
    return { status: e.statusCode || 500, payload: { error: e.message }, headers, body };
  }
  return { status, payload, headers, body };
};

d("Site (HTTP)", () => {
  let companyId: number;
  let otherId: number;
  let token: string;

  beforeAll(async () => {
    const mk = async (n: string) =>
      ((await sequelize.query(`INSERT INTO "Companies" (name, "createdAt", "updatedAt") VALUES ('${n}', now(), now()) RETURNING id`))[0] as any[])[0].id;
    companyId = await mk("Site http A");
    otherId = await mk("Site http B");
    token = (await ensureRow(siteStore(companyId))).token;
    resetLimits();
  });

  afterAll(async () => {
    await sequelize.query(`DELETE FROM "Companies" WHERE id IN (${companyId}, ${otherId})`);
    await sequelize.close();
  });

  it("qualquer usuário lê a configuração; só administrador salva e publica", async () => {
    const r = await call(A.index, { user: user(companyId) });
    expect(r.payload.site.brand.name).toBe("Minha empresa");
    expect(r.payload.token).toBe(token);
    expect(Array.isArray(r.payload.texts)).toBe(true);

    expect((await call(A.update, { user: user(companyId), body: { brand: { name: "X" } } })).status).toBe(403);
    expect((await call(A.publishSite, { user: user(companyId) })).status).toBe(403);
    expect((await call(A.newToken, { user: user(companyId) })).status).toBe(403);

    const ok = await call(A.update, { user: admin(companyId), body: { brand: { name: "Salus Tech" } } });
    expect(ok.payload.site.brand.name).toBe("Salus Tech");
    expect(ok.payload.published).toBe(false);
    expect((await call(A.publishSite, { user: admin(companyId) })).payload.published).toBe(true);
  });

  it("configuração inválida volta como 400 com a causa", async () => {
    const r = await call(A.update, { user: admin(companyId), body: { contact: { email: "nao-e-email" } } });
    expect(r.status).toBe(400);
    expect(r.payload.error).toMatch(/E-mail/);
  });

  it("widget: token desconhecido devolve 404 e não entrega script", async () => {
    const r = await call(P.widget, { params: { token: "b".repeat(24) } });
    expect(r.status).toBe(404);
    expect(r.body).toContain("não encontrado");
    const ok = await call(P.widget, { params: { token } });
    expect(ok.headers["content-type"]).toMatch(/javascript/);
    expect(ok.body).toContain(token);
  });

  it("chat público: sessão inválida, texto vazio e site desligado", async () => {
    expect((await call(P.chat, { params: { token }, body: { session: "x" } })).status).toBe(400);
    const r = await call(P.chat, { params: { token }, body: { session: "sess-http-0001" } });
    expect(r.status).toBe(400);
    expect(r.payload.error).toMatch(/texto/);

    await call(A.update, { user: admin(companyId), body: { chat: { enabled: false } } });
    await call(A.publishSite, { user: admin(companyId) });
    const off = await call(P.chat, { params: { token }, body: { session: "sess-http-0001", text: "oi" } });
    expect(off.status).toBe(503);
    await call(A.update, { user: admin(companyId), body: { chat: { enabled: true } } });
    await call(A.publishSite, { user: admin(companyId) });
  });

  it("origem fora da lista é recusada, e a permitida recebe o cabeçalho de CORS", async () => {
    await call(A.update, { user: admin(companyId), body: { chat: { origins: ["https://meusite.com.br"] } } });
    await call(A.publishSite, { user: admin(companyId) });

    const bad = await call(P.config, { params: { token }, headers: { origin: "https://invasor.com.br" } });
    expect(bad.status).toBe(403);
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();

    const good = await call(P.config, { params: { token }, headers: { origin: "https://meusite.com.br" } });
    expect(good.status).toBe(200);
    expect(good.headers["access-control-allow-origin"]).toBe("https://meusite.com.br");
    expect(good.payload.texts["chat.send"]).toBe("Enviar");

    await call(A.update, { user: admin(companyId), body: { chat: { origins: [] } } });
    await call(A.publishSite, { user: admin(companyId) });
  });

  it("abrir o chat registra no funil e o contato entra na lista", async () => {
    expect((await call(P.chat, { params: { token }, body: { session: "sess-http-0002", event: "open" } })).payload.ok).toBe(true);
    const bad = await call(P.lead, { params: { token }, body: { session: "sess-http-0002", name: "Felipe", contact: "oi" } });
    expect(bad.status).toBe(400);
    const ok = await call(P.lead, { params: { token }, body: { session: "sess-http-0002", name: "Felipe", contact: "felipe@exemplo.com.br" } });
    expect(ok.status).toBe(201);

    const leads = await call(A.leads, { user: user(companyId) });
    expect(leads.payload[0].contact).toBe("felipe@exemplo.com.br");
    const f = await call(A.funnelReport, { user: user(companyId), query: { days: "30" } });
    const n = (id: string) => f.payload.steps.filter((s: any) => s.id === id)[0].n;
    expect(n("open")).toBe(1);
    expect(n("lead")).toBe(1);

    await call(A.leadStatus, { user: user(companyId), params: { id: leads.payload[0].id }, body: { status: "done" } });
    expect((await call(A.leads, { user: user(companyId) })).payload[0].status).toBe("done");
  });

  it("sem chave do modelo o chat não inventa resposta: pede o contato", async () => {
    const keys = ["N1_ANTHROPIC_KEY", "ANTHROPIC_API_KEY"];
    const saved = keys.map(k => process.env[k]);
    keys.forEach(k => delete process.env[k]);
    const r = await call(P.chat, { params: { token }, body: { session: "sess-http-0003", text: "como emito a nota fiscal" } });
    keys.forEach((k, i) => {
      if (saved[i] !== undefined) process.env[k] = saved[i];
    });
    expect(r.status).toBe(200);
    expect(r.payload.decision).toBe("handoff");
    expect(r.payload.handoff).toBe(true);
    expect(r.payload.messages[0].text).toMatch(/pessoa da equipe/);
  });

  it("o painel de uma empresa não vê os contatos nem o funil da outra", async () => {
    expect((await call(A.leads, { user: user(otherId) })).payload).toHaveLength(0);
    const f = await call(A.funnelReport, { user: user(otherId), query: {} });
    expect(f.payload.steps.filter((s: any) => s.id === "open")[0].n).toBe(0);
    expect((await call(A.index, { user: user(otherId) })).payload.token).not.toBe(token);
  });

  it("trocar o token derruba a tag antiga", async () => {
    const r = await call(A.newToken, { user: admin(companyId) });
    expect(r.payload.token).not.toBe(token);
    expect((await call(P.config, { params: { token } })).status).toBe(404);
    expect((await call(P.config, { params: { token: r.payload.token } })).status).toBe(200);
    token = r.payload.token;
  });
});
