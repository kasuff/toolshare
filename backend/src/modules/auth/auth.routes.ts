import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { authRateLimiter } from "../../middleware/rate-limit";
import { validate } from "../../middleware/validate";
import { authController } from "./auth.controller";
import { changePasswordSchema, loginSchema, refreshSchema, registerSchema } from "./auth.schema";

export const authRouter = Router();

authRouter.use(authRateLimiter);

authRouter.post("/register", validate(registerSchema), authController.register);
authRouter.post("/login", validate(loginSchema), authController.login);
authRouter.post("/refresh", validate(refreshSchema), authController.refresh);
authRouter.post(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  authController.changePassword
);
