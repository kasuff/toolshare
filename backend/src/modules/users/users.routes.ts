import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/require-role";
import { validate } from "../../middleware/validate";
import { usersController } from "./users.controller";
import {
  listUsersSchema,
  updateMyProfileSchema,
  updateUserRoleSchema,
  userIdParamSchema
} from "./users.schema";

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.get("/me", usersController.getMine);
usersRouter.patch("/me", validate(updateMyProfileSchema), usersController.updateMine);

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