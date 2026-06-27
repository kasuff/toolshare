import { Router } from "express";
import { requireAuth } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/require-role";
import { validate } from "../../../middleware/validate";
import { usersController } from "./users.controller";
import {
  decideSuspensionRequestSchema,
  listUsersSchema,
  updateMyProfileSchema,
  updateUserRoleSchema,
  updateUserSuspensionSchema,
  userIdParamSchema
} from "./users.schema";

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.get("/me", usersController.getMine);
usersRouter.patch("/me", validate(updateMyProfileSchema), usersController.updateMine);
usersRouter.get("/admin/metrics", requireRole("MANAGER"), usersController.adminMetrics);
usersRouter.get(
  "/admin/suspension-requests",
  requireRole("MANAGER"),
  usersController.listSuspensionRequests
);
usersRouter.patch(
  "/admin/suspension-requests/:requestId",
  requireRole("MANAGER"),
  validate(decideSuspensionRequestSchema),
  usersController.decideSuspensionRequest
);

usersRouter.get("/", requireRole("MODERATOR", "MANAGER"), validate(listUsersSchema), usersController.list);
usersRouter.get(
  "/:id",
  requireRole("MODERATOR", "MANAGER"),
  validate(userIdParamSchema),
  usersController.getById
);
usersRouter.patch(
  "/:id/role",
  requireRole("MANAGER"),
  validate(updateUserRoleSchema),
  usersController.updateRole
);
usersRouter.patch(
  "/:id/suspension",
  requireRole("MANAGER"),
  validate(updateUserSuspensionSchema),
  usersController.updateSuspension
);