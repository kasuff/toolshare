import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { ratingsController } from "./ratings.controller";
import { createRatingSchema, ratingsForUserSchema } from "./ratings.schema";

export const ratingsRouter = Router();

ratingsRouter.use(requireAuth);

ratingsRouter.post("/", validate(createRatingSchema), ratingsController.create);
ratingsRouter.get("/me/received", ratingsController.listMineReceived);
ratingsRouter.get("/me/given", ratingsController.listMineGiven);
ratingsRouter.get("/users/:id", validate(ratingsForUserSchema), ratingsController.listForUser);