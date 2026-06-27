import { Router } from "express";
import { requireAuth } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import { toolsController } from "./tools.controller";
import {
  createToolSchema,
  listToolsSchema,
  toolIdParamSchema,
  toolOwnerBlockParamSchema,
  updateToolSchema
} from "./tools.schema";

export const toolsRouter = Router();

toolsRouter.get("/", validate(listToolsSchema), toolsController.list);
toolsRouter.get(
  "/:id/blocking-periods",
  validate(toolIdParamSchema),
  toolsController.listBlockingPeriods
);
toolsRouter.get(
  "/:id/owner-blocks",
  requireAuth,
  validate(toolIdParamSchema),
  toolsController.listOwnerBlocks
);
toolsRouter.delete(
  "/:id/owner-blocks/:bookingId",
  requireAuth,
  validate(toolOwnerBlockParamSchema),
  toolsController.deleteOwnerBlock
);
toolsRouter.get("/:id", validate(toolIdParamSchema), toolsController.getById);

toolsRouter.post("/", requireAuth, validate(createToolSchema), toolsController.create);
toolsRouter.patch("/:id", requireAuth, validate(updateToolSchema), toolsController.update);
toolsRouter.delete("/:id", requireAuth, validate(toolIdParamSchema), toolsController.remove);