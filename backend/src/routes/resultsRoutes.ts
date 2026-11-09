import { Router } from "express";
import * as C from "../controllers/ResultsController";
import isAuth from "../middleware/isAuth";

const routes = Router();

routes.get("/results", isAuth, C.index);

export default routes;
