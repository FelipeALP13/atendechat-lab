import { Router } from "express";
import * as C from "../controllers/SiteController";
import isAuth from "../middleware/isAuth";

const routes = Router();

routes.get("/site/config", isAuth, C.index);
routes.put("/site/config", isAuth, C.update);
routes.post("/site/publish", isAuth, C.publishSite);
routes.post("/site/discard", isAuth, C.discard);
routes.post("/site/token", isAuth, C.newToken);
routes.get("/site/funnel", isAuth, C.funnelReport);
routes.get("/site/leads", isAuth, C.leads);
routes.post("/site/leads/:id/status", isAuth, C.leadStatus);

export default routes;
