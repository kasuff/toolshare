import { Router } from "express";
import { validate } from "../../../middleware/validate";
import { addressController } from "./address.controller";
import { suggestAddressSchema, validateAddressSchema } from "./address.schema";

export const addressRouter = Router();

addressRouter.get("/suggest", validate(suggestAddressSchema), addressController.suggest);
addressRouter.get("/validate", validate(validateAddressSchema), addressController.validate);