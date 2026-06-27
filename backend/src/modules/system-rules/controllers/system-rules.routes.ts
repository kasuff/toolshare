import { Router } from "express";
import { requireAuth } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/require-role";
import { validate } from "../../../middleware/validate";
import { systemRulesController } from "./system-rules.controller";
import { updateSystemSettingSchema } from "./system-rules.schema";

export const systemRulesRouter = Router();

systemRulesRouter.use(requireAuth);
systemRulesRouter.use(requireRole("MANAGER"));

systemRulesRouter.get("/", systemRulesController.list);
systemRulesRouter.put("/:key", validate(updateSystemSettingSchema), systemRulesController.update);