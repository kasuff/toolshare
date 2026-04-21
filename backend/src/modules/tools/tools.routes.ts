import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { toolsController } from "./tools.controller";
import {
  createToolSchema,
  listToolsSchema,
  toolIdParamSchema,
  updateToolSchema
} from "./tools.schema";

export const toolsRouter = Router();

toolsRouter.get("/", validate(listToolsSchema), toolsController.list);
toolsRouter.get("/:id", validate(toolIdParamSchema), toolsController.getById);

toolsRouter.post("/", requireAuth, validate(createToolSchema), toolsController.create);
toolsRouter.patch("/:id", requireAuth, validate(updateToolSchema), toolsController.update);
toolsRouter.delete("/:id", requireAuth, validate(toolIdParamSchema), toolsController.remove);