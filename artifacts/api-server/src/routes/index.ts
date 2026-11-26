import { Router, type IRouter } from "express";
import healthRouter from "./health";
import calendarsRouter from "./calendars";
import { createEstimateRouter } from "./openai/estimate";
import { generateEstimate } from "../lib/estimate-provider";

const router: IRouter = Router();

router.use(healthRouter);
router.use(calendarsRouter);
router.use(createEstimateRouter(generateEstimate));

export default router;
