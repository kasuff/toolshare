import { z } from "zod";
import {
  suggestAddressQuerySchema,
  validateAddressQuerySchema
} from "@toolshare/shared/contracts/request/address.schema";

export const suggestAddressSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: suggestAddressQuerySchema
});

export const validateAddressSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: validateAddressQuerySchema
});
