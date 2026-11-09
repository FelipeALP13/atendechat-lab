import { Request, Response } from "express";
import { n1Store } from "../services/AgentN1/Runtime";
import { results } from "../services/ResultsService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
  return res.json(await results(n1Store(req.user.companyId), days));
};
