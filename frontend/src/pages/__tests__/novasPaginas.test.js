/**
 * As telas novas (Agente N1, Site e chat, Resultados) precisam abrir sem quebrar
 * com os dados que o backend devolve de verdade. A API é simulada aqui.
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

jest.mock("../../services/api", () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn(), post: jest.fn() } }));
jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: require("react").createContext({ user: { profile: "admin", companyId: 1 } })
}));
jest.mock("react-toastify", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const api = require("../../services/api").default;
const AgenteN1 = require("../AgenteN1").default;
const Site = require("../Site").default;
const Resultados = require("../Resultados").default;

const SITE = {
  site: {
    brand: { name: "Salus Tech", color: "#3943ce", logoUrl: "", position: "right", agentName: "Júlia" },
    seo: { title: "", description: "" },
    contact: { whatsapp: "", email: "", phone: "", termsUrl: "", privacyUrl: "" },
    chat: { enabled: true, origins: [], dailyLimit: 500, schedule: { mode: "hours", start: "08:00", end: "18:00", days: [1, 2, 3, 4, 5] } },
    texts: {}
  },
  published: false,
  publishedAt: null,
  token: "abc123def456abc123def456",
  texts: [{ key: "chat.title", group: "Chat · Cabeçalho", label: "Título", def: "Suporte", max: 40 }],
  base: "https://api.exemplo.com.br"
};

const RESULTS = {
  days: 30,
  fx: 5.5,
  totals: { conversations: 4, resolved: 2, escalated: 2, resolvedPct: 50, costUsd: 0.07, costBrl: 0.39, costPerConversationBrl: 0.1, costPerResolvedBrl: 0.19 },
  channels: { site: { conversations: 2, resolved: 1, escalated: 1, costBrl: 0.22 }, whatsapp: { conversations: 2, resolved: 1, escalated: 1, costBrl: 0.17 } },
  decisions: { answer: 3, handoff: 1 },
  daily: [{ day: Date.now() - 86400000, conversations: 2, escalated: 1, costBrl: 0.2 }, { day: Date.now(), conversations: 2, escalated: 1, costBrl: 0.19 }],
  campaigns: [{ campaign: "black-friday", sessions: 1, conversations: 1, escalated: 0, leads: 1, costBrl: 0.1 }],
  topGaps: [{ question: "como emito a nota", times: 4, lastAt: Date.now() }]
};

const N1_CONFIG = {
  config: {
    name: "Júlia",
    product: "SGE",
    introduceAsAssistant: true,
    answerAt: 75,
    draftAt: 60,
    monthlyCap: 300,
    fx: 5.5,
    gitbookUrl: "https://docs.exemplo.io/x",
    handoffRules: { asks_human: true, repetition: true, billing_complaint: true, angry: true, outage: false },
    queues: { default: null }
  },
  stats: { pages: 12, approved: 3, lastSyncAt: Date.now() }
};

const route = (path, data) => {
  api.get.mockImplementation(url => {
    const key = Object.keys(data).find(k => url.indexOf(k) === 0);
    return Promise.resolve({ data: key ? data[key] : [] });
  });
};

const show = Component =>
  render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>
  );

beforeEach(() => jest.clearAllMocks());

test("Agente N1 abre na configuração com os valores salvos", async () => {
  route("/n1/config", { "/n1/config": N1_CONFIG, "/queue": [{ id: 7, name: "Suporte" }] });
  show(AgenteN1);
  expect(await screen.findByDisplayValue("Júlia")).toBeInTheDocument();
  expect(screen.getByDisplayValue("SGE")).toBeInTheDocument();
  expect(screen.getByText(/12 páginas indexadas/)).toBeInTheDocument();
  expect(screen.getByText(/3 respostas aprovadas/)).toBeInTheDocument();
});

test("Site e chat abre com o rascunho e avisa que não está publicado", async () => {
  route("/site/config", { "/site/config": SITE });
  show(Site);
  expect(await screen.findByDisplayValue("Salus Tech")).toBeInTheDocument();
  expect(screen.getByText("Alterações não publicadas")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Júlia")).toBeInTheDocument();
});

test("Resultados mostra o resumo em reais e as campanhas", async () => {
  route("/results", { "/results": RESULTS });
  show(Resultados);
  expect(await screen.findByText("50%")).toBeInTheDocument();
  expect(screen.getByText(/Resolvidas sem a equipe \(2\)/)).toBeInTheDocument();
  expect(screen.getByText("black-friday")).toBeInTheDocument();
  expect(screen.getByText("como emito a nota")).toBeInTheDocument();
});

test("Resultados sem movimento não quebra nem inventa número", async () => {
  route("/results", {
    "/results": { ...RESULTS, totals: { ...RESULTS.totals, conversations: 0, resolved: 0, escalated: 0, resolvedPct: 0 }, daily: [], campaigns: [], decisions: {}, topGaps: [] }
  });
  show(Resultados);
  await waitFor(() => expect(screen.getByText("0%")).toBeInTheDocument());
  expect(screen.getByText("Nenhuma visita ao chat do site no período.")).toBeInTheDocument();
  expect(screen.getByText("Nenhuma lacuna pendente.")).toBeInTheDocument();
});
