import { Router, type IRouter } from "express";
import healthRouter from "./health";
import calendarsRouter from "./calendars";

const router: IRouter = Router();

router.use(healthRouter);
router.use(calendarsRouter);

export default router;
