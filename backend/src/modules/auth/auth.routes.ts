import { Router } from "express";
import { authRateLimiter } from "../../middleware/rate-limit";
import { validate } from "../../middleware/validate";
import { authController } from "./auth.controller";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schema";

export const authRouter = Router();

authRouter.use(authRateLimiter);

authRouter.post("/register", validate(registerSchema), authController.register);
authRouter.post("/login", validate(loginSchema), authController.login);
authRouter.post("/refresh", validate(refreshSchema), authController.refresh);
