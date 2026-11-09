import { Router } from "express";
import * as C from "../controllers/AgentN1Controller";
import isAuth from "../middleware/isAuth";

const routes = Router();

routes.get("/n1/config", isAuth, C.getConfig);
routes.put("/n1/config", isAuth, C.putConfig);
routes.post("/n1/sync", isAuth, C.sync);
routes.get("/n1/proposals", isAuth, C.proposals);
routes.post("/n1/proposals/answer", isAuth, C.answer);
routes.post("/n1/proposals/:id/approve", isAuth, C.approveProposal);
routes.post("/n1/proposals/:id/reject", isAuth, C.rejectProposal);
routes.get("/n1/approved", isAuth, C.approvedList);
routes.post("/n1/approved/:id/revoke", isAuth, C.revoke);
routes.get("/n1/audit", isAuth, C.audit);
routes.get("/n1/usage", isAuth, C.usage);

export default routes;
