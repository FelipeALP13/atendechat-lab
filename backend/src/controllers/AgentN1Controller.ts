import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { loadConfig, saveConfig } from "../services/AgentN1/config";
import { assertPublicSource, syncGitbook } from "../services/AgentN1/gitbook";
import { stats } from "../services/AgentN1/knowledge";
import { approve, listProposals, recordAnswer, reject, revokeApproved } from "../services/AgentN1/proposals";
import { n1Store } from "../services/AgentN1/Runtime";
import { spent } from "../services/AgentN1/agent";

const store = (req: Request) => n1Store(req.user.companyId);

/** Configuração, sincronização e aprovação de conhecimento são do administrador. */
const adminOnly = (req: Request) => {
  if (req.user.profile !== "admin") throw new AppError("Somente administradores podem fazer isso.", 403);
};

const who = async (req: Request): Promise<string> => {
  const User = (await import("../models/User")).default;
  const u = await User.findByPk(req.user.id, { attributes: ["name"] });
  return (u && u.name) || `usuário ${req.user.id}`;
};

export const getConfig = async (req: Request, res: Response): Promise<Response> => {
  const s = store(req);
  return res.json({ config: await loadConfig(s), stats: await stats(s) });
};

export const putConfig = async (req: Request, res: Response): Promise<Response> => {
  adminOnly(req);
  try {
    return res.json({ config: await saveConfig(store(req), req.body || {}) });
  } catch (e) {
    throw new AppError(e instanceof Error ? e.message : "Configuração inválida", 400);
  }
};

export const sync = async (req: Request, res: Response): Promise<Response> => {
  adminOnly(req);
  const s = store(req);
  const cfg = await loadConfig(s);
  if (!cfg.gitbookUrl) throw new AppError("Informe o endereço da documentação (GitBook) na configuração.", 400);
  try { assertPublicSource(cfg.gitbookUrl); } catch (e) { throw new AppError((e as Error).message, 400); }
  try {
    return res.json({ result: await syncGitbook(s, cfg.gitbookUrl), stats: await stats(s) });
  } catch (e) {
    throw new AppError(`Não foi possível ler a documentação: ${(e as Error).message}`, 502);
  }
};

export const proposals = async (req: Request, res: Response): Promise<Response> =>
  res.json(await listProposals(store(req), String(req.query.status || "pending")));

export const answer = async (req: Request, res: Response): Promise<Response> => {
  const { question, answer: text, page } = req.body || {};
  if (!question || !text) throw new AppError("Informe a pergunta e a resposta.", 400);
  const id = await recordAnswer(store(req), String(question).slice(0, 500), await who(req), String(text).slice(0, 4000), page ? String(page) : null);
  return res.status(201).json({ id });
};

export const approveProposal = async (req: Request, res: Response): Promise<Response> => {
  adminOnly(req);
  try {
    const id = await approve(store(req), Number(req.params.id), await who(req), req.body && req.body.answer ? String(req.body.answer) : undefined);
    return res.json({ approvedId: id });
  } catch (e) {
    throw new AppError((e as Error).message, 400);
  }
};

export const rejectProposal = async (req: Request, res: Response): Promise<Response> => {
  adminOnly(req);
  await reject(store(req), Number(req.params.id));
  return res.json({ ok: true });
};

export const approvedList = async (req: Request, res: Response): Promise<Response> =>
  res.json(await store(req).run(`SELECT id, question, body, "approvedBy", "approvedAt"::float8 "approvedAt", "basedOnPage", status FROM "N1Approved" WHERE "companyId" = $1 ORDER BY id DESC LIMIT 200`, [req.user.companyId]));

export const revoke = async (req: Request, res: Response): Promise<Response> => {
  adminOnly(req);
  await revokeApproved(store(req), Number(req.params.id));
  return res.json({ ok: true });
};

export const audit = async (req: Request, res: Response): Promise<Response> =>
  res.json(await store(req).run(`SELECT id, at::float8 at, conversation, question, decision, reason, confidence, sources, cost FROM "N1Audit" WHERE "companyId" = $1 ORDER BY id DESC LIMIT 200`, [req.user.companyId]));

export const usage = async (req: Request, res: Response): Promise<Response> => {
  const s = store(req);
  const cfg = await loadConfig(s);
  const usd = await spent(s);
  return res.json({ month: new Date().toISOString().slice(0, 7), spentUsd: usd, spent: Math.round(usd * cfg.fx * 100) / 100, cap: cfg.monthlyCap, fx: cfg.fx });
};
