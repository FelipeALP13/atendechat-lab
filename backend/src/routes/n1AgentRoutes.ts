import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as N1AgentController from "../controllers/N1AgentController";

const n1AgentRoutes = Router();

n1AgentRoutes.get("/n1-agent", isAuth, N1AgentController.show);
n1AgentRoutes.put("/n1-agent", isAuth, N1AgentController.update);
n1AgentRoutes.post("/n1-agent/test-portal", isAuth, N1AgentController.testPortal);
n1AgentRoutes.post("/n1-agent/simulate", isAuth, N1AgentController.simulate);

export default n1AgentRoutes;
