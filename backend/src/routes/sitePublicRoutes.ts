import { Router } from "express";
import * as C from "../controllers/SitePublicController";

/**
 * Rotas abertas do chat do site. Montadas antes do CORS do painel (em app.ts),
 * porque cada empresa libera os próprios endereços.
 */
const routes = Router();

routes.options("/site/:token/:action", C.options);
routes.get("/site/:token/widget.js", C.widget);
routes.get("/site/:token/config", C.config);
routes.post("/site/:token/chat", C.chat);
routes.post("/site/:token/lead", C.lead);

export default routes;
