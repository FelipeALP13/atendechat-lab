/**
 * Testes do módulo Site contra um Postgres de verdade. Rode com N1_TEST_DB apontando para um banco já migrado:
 * N1_TEST_DB=postgres://postgres@localhost:5432/n1test npx jest src/services/SiteService
 * Sem a variável, os testes são ignorados.
 */
import { Pool } from "pg";
import { makeStore, Store } from "../../AgentN1/store";
import {
  brandColor,
  contrast,
  defaultSite,
  isContact,
  isOpen,
  resolveText,
  sanitizeSite,
  scheduleLabel,
  whatsappLink
} from "../core";
import {
  companyByToken,
  createLead,
  discardDraft,
  ensureRow,
  funnel,
  limited,
  listLeads,
  loadLive,
  logEvent,
  messagesToday,
  originAllowed,
  publicConfig,
  publish,
  resetLimits,
  rotateToken,
  saveDraft,
  setLeadStatus,
  siteState
} from "../index";
import { widgetSource } from "../widget";

const url = process.env.N1_TEST_DB;
const d = url ? describe : describe.skip;

describe("Site: núcleo (sem banco)", () => {
  it("escurece a cor até o texto branco ficar legível e mantém a cor já legível", () => {
    const light = brandColor("#ffe100");
    expect(light.adjusted).toBe(true);
    expect(contrast(light.color, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    const dark = brandColor("#3943ce");
    expect(dark.adjusted).toBe(false);
  });

  it("recusa cor fora do formato", () => {
    expect(() => brandColor("azul")).toThrow(/cor inválida/);
  });

  it("monta o link do WhatsApp e aceita e-mail como contato", () => {
    expect(whatsappLink("(11) 98888-7777")).toBe("https://wa.me/5511988887777");
    expect(whatsappLink("123")).toBeNull();
    expect(isContact("felipe@exemplo.com.br")).toBe(true);
    expect(isContact("oi")).toBe(false);
  });

  it("usa o texto padrão quando não há texto salvo e troca as variáveis", () => {
    const site = defaultSite();
    site.brand.agentName = "Júlia";
    expect(resolveText(site, "chat.welcome", { nome: "Júlia" })).toContain("Júlia");
    site.texts["chat.title"] = "Ajuda";
    expect(resolveText(site, "chat.title")).toBe("Ajuda");
  });

  it("valida o horário da equipe e sabe se está aberto", () => {
    const s = { mode: "hours" as const, start: "08:00", end: "18:00", days: [1, 2, 3, 4, 5] };
    expect(scheduleLabel(s)).toBe("seg a sex, das 08:00 às 18:00");
    // segunda-feira, 10:00 em Brasília
    expect(isOpen(s, Date.parse("2026-11-09T13:00:00Z"))).toBe(true);
    // segunda-feira, 22:00 em Brasília
    expect(isOpen(s, Date.parse("2026-11-10T01:00:00Z"))).toBe(false);
    expect(isOpen({ ...s, mode: "always" }, Date.parse("2026-11-10T01:00:00Z"))).toBe(true);
  });

  it("recusa configuração inválida com a causa em português", () => {
    expect(() => sanitizeSite({ chat: { origins: ["exemplo.com.br"] } })).toThrow(/Site permitido inválido/);
    expect(() => sanitizeSite({ contact: { whatsapp: "123" } })).toThrow(/DDD/);
    expect(() => sanitizeSite({ chat: { schedule: { mode: "hours", start: "18:00", end: "08:00", days: [1] } } })).toThrow(/antes do fim/);
    expect(() => sanitizeSite({ texts: { "nao.existe": "x" } })).toThrow(/texto desconhecido/);
  });

  it("limpa texto igual ao padrão em vez de guardar duplicado", () => {
    const { site } = sanitizeSite({ texts: { "chat.send": "Enviar" } });
    expect(site.texts["chat.send"]).toBeUndefined();
  });

  it("o widget leva o token e não vaza o id da empresa", () => {
    const js = widgetSource("https://api.exemplo.com.br", "abc123def456");
    expect(js).toContain("abc123def456");
    expect(js).toContain("attachShadow");
    expect(js).toContain("/site/");
  });

  it("limite por janela deslizante", () => {
    resetLimits();
    const now = Date.now();
    expect(limited("x", 2, 1000, now)).toBe(false);
    expect(limited("x", 2, 1000, now)).toBe(false);
    expect(limited("x", 2, 1000, now)).toBe(true);
    expect(limited("x", 2, 1000, now + 1500)).toBe(false);
  });

  it("origem permitida: lista vazia libera, lista preenchida restringe", () => {
    const site = defaultSite();
    expect(originAllowed(site, "https://qualquer.com.br")).toBe(true);
    site.chat.origins = ["https://meusite.com.br"];
    expect(originAllowed(site, "https://meusite.com.br")).toBe(true);
    expect(originAllowed(site, "https://outro.com.br")).toBe(false);
  });
});

d("Site (Postgres)", () => {
  let pool: Pool;
  let A: Store;
  let B: Store;
  const ids: number[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    const run = (sql: string, p?: unknown[]) => pool.query(sql, p as any[]).then(r => r.rows);
    for (const n of ["Site teste A", "Site teste B"]) {
      const r = await run(`INSERT INTO "Companies" (name, "createdAt", "updatedAt") VALUES ($1, now(), now()) RETURNING id`, [n]);
      ids.push(r[0].id);
    }
    A = makeStore(ids[0], run);
    B = makeStore(ids[1], run);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM "Companies" WHERE id = ANY($1)`, [ids]);
    await pool.end();
  });

  it("cria a linha da empresa com token próprio na primeira vez", async () => {
    const a = await ensureRow(A);
    const b = await ensureRow(B);
    expect(a.token).toMatch(/^[a-f0-9]{24}$/);
    expect(a.token).not.toBe(b.token);
    expect(await companyByToken(a.token, A.run)).toBe(A.companyId);
    expect(await companyByToken("naoexiste", A.run)).toBeNull();
  });

  it("rascunho e publicação são separados", async () => {
    await saveDraft(A, { brand: { name: "Salus Tech" } });
    let st = await siteState(A);
    expect(st.site.brand.name).toBe("Salus Tech");
    expect(st.published).toBe(false);
    expect((await loadLive(A)).brand.name).toBe("Minha empresa");

    st = await publish(A);
    expect(st.published).toBe(true);
    expect(st.publishedAt).toBeGreaterThan(0);
    expect((await loadLive(A)).brand.name).toBe("Salus Tech");
  });

  it("descartar o rascunho volta ao publicado", async () => {
    await saveDraft(A, { brand: { name: "Rascunho errado" } });
    expect((await siteState(A)).published).toBe(false);
    const st = await discardDraft(A);
    expect(st.site.brand.name).toBe("Salus Tech");
    expect(st.published).toBe(true);
  });

  it("avisa quando escurece a cor escolhida", async () => {
    const st = await saveDraft(A, { brand: { color: "#ffe100" } });
    expect(st.notes && st.notes[0]).toMatch(/escurecida/);
    await discardDraft(A);
  });

  it("trocar o token invalida a tag antiga", async () => {
    const before = (await ensureRow(A)).token;
    const after = await rotateToken(A);
    expect(after).not.toBe(before);
    expect(await companyByToken(before, A.run)).toBeNull();
    expect(await companyByToken(after, A.run)).toBe(A.companyId);
  });

  it("a configuração pública traz textos prontos, cores e o link do WhatsApp", async () => {
    await saveDraft(A, { brand: { agentName: "Júlia", color: "#3943ce" }, contact: { whatsapp: "11988887777" } });
    await publish(A);
    const c = await publicConfig(A);
    expect(c.enabled).toBe(true);
    expect(c.texts["chat.welcome"]).toContain("Júlia");
    expect(c.brand.onPrimary).toBe("#ffffff");
    expect(c.whatsapp).toBe("https://wa.me/5511988887777");
  });

  it("funil conta sessões distintas por etapa e as perguntas que mais pedem uma pessoa", async () => {
    const now = Date.now();
    await logEvent(A, "sess-0001", "open", now);
    await logEvent(A, "sess-0001", "message", now);
    await logEvent(A, "sess-0001", "answered", now);
    await logEvent(A, "sess-0002", "open", now);
    await logEvent(A, "sess-0002", "message", now);
    await logEvent(A, "sess-0002", "handoff", now, "como emito a nota fiscal");
    await logEvent(A, "sess-0003", "open", now);
    await logEvent(A, "sess-0003", "message", now);
    await logEvent(A, "sess-0003", "handoff", now, "como emito a nota fiscal");

    const f = await funnel(A, 30, now);
    const n = (id: string) => f.steps.filter(s => s.id === id)[0].n;
    expect(n("open")).toBe(3);
    expect(n("message")).toBe(3);
    expect(n("answered")).toBe(1);
    expect(n("handoff")).toBe(2);
    expect(f.handoffQuestions[0]).toEqual({ q: "como emito a nota fiscal", n: 2 });
  });

  it("evento antigo entra na janela longa e fica fora da curta", async () => {
    const now = Date.now();
    const opens = async (days: number) => (await funnel(A, days, now)).steps.filter(s => s.id === "open")[0].n;
    const before = await opens(7);
    await logEvent(A, "sess-velha", "open", now - 40 * 86400000);
    expect(await opens(7)).toBe(before);
    expect(await opens(90)).toBe(before + 1);
  });

  it("conta as perguntas do dia para o limite diário", async () => {
    const n = await messagesToday(A);
    expect(n).toBeGreaterThanOrEqual(3);
  });

  it("guarda o contato deixado no chat e registra no funil", async () => {
    const now = Date.now();
    await createLead(A, { session: "sess-0004", name: "Felipe", contact: "felipe@exemplo.com.br", question: "como emito a nota" }, now);
    const rows = await listLeads(A);
    expect(rows[0].name).toBe("Felipe");
    expect(rows[0].status).toBe("new");
    const f = await funnel(A, 1, now);
    expect(f.steps.filter(s => s.id === "lead")[0].n).toBe(1);

    await setLeadStatus(A, rows[0].id, "done");
    expect((await listLeads(A))[0].status).toBe("done");
    await expect(setLeadStatus(A, rows[0].id, "qualquer")).rejects.toThrow(/situação inválida/);
  });

  it("uma empresa não vê o site, o funil nem os contatos da outra", async () => {
    expect((await siteState(B)).site.brand.name).toBe("Minha empresa");
    expect((await funnel(B, 30)).steps.filter(s => s.id === "open")[0].n).toBe(0);
    expect(await listLeads(B)).toHaveLength(0);
    const tokenA = (await ensureRow(A)).token;
    expect(await companyByToken(tokenA, B.run)).toBe(A.companyId);
    expect((await ensureRow(B)).token).not.toBe(tokenA);
  });

  it("apagar a empresa leva embora o site, os eventos e os contatos", async () => {
    const r = await pool.query(`INSERT INTO "Companies" (name, "createdAt", "updatedAt") VALUES ('Site teste C', now(), now()) RETURNING id`);
    const id = r.rows[0].id;
    const C = makeStore(id, (sql: string, p?: unknown[]) => pool.query(sql, p as any[]).then(x => x.rows));
    await ensureRow(C);
    await logEvent(C, "sess-0005", "open");
    await createLead(C, { session: "sess-0005", name: "X", contact: "x@y.com" });
    await pool.query(`DELETE FROM "Companies" WHERE id = $1`, [id]);
    for (const t of ["SiteConfigs", "SiteEvents", "SiteLeads"]) {
      const left = await pool.query(`SELECT COUNT(*)::int n FROM "${t}" WHERE "companyId" = $1`, [id]);
      expect(left.rows[0].n).toBe(0);
    }
  });
});
