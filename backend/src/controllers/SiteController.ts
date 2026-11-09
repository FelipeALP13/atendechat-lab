import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  discardDraft,
  funnel,
  listLeads,
  publish,
  rotateToken,
  saveDraft,
  setLeadStatus,
  siteState,
  siteStore
} from "../services/SiteService";
import { TEXTS } from "../services/SiteService/core";

const store = (req: Request) => siteStore(req.user.companyId);

/** Publicar o site e trocar o token são do administrador. */
const adminOnly = (req: Request) => {
  if (req.user.profile !== "admin") throw new AppError("Somente administradores podem fazer isso.", 403);
};

const publicBase = () => (process.env.BACKEND_URL || "").replace(/\/$/, "");

export const index = async (req: Request, res: Response): Promise<Response> => {
  const state = await siteState(store(req));
  return res.json({ ...state, texts: TEXTS, base: publicBase() });
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  adminOnly(req);
  try {
    return res.json(await saveDraft(store(req), req.body || {}));
  } catch (e) {
    throw new AppError(e instanceof Error ? e.message : "Configuração inválida", 400);
  }
};

export const publishSite = async (req: Request, res: Response): Promise<Response> => {
  adminOnly(req);
  return res.json(await publish(store(req)));
};

export const discard = async (req: Request, res: Response): Promise<Response> => {
  adminOnly(req);
  return res.json(await discardDraft(store(req)));
};

export const newToken = async (req: Request, res: Response): Promise<Response> => {
  adminOnly(req);
  return res.json({ token: await rotateToken(store(req)) });
};

export const funnelReport = async (req: Request, res: Response): Promise<Response> => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
  return res.json(await funnel(store(req), days));
};

export const leads = async (req: Request, res: Response): Promise<Response> => res.json(await listLeads(store(req)));

export const leadStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    await setLeadStatus(store(req), Number(req.params.id), String((req.body || {}).status || ""));
  } catch (e) {
    throw new AppError((e as Error).message, 400);
  }
  return res.json({ ok: true });
};
