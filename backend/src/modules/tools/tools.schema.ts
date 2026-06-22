import { z } from "zod";
import {
  createToolBodySchema,
  listToolsQuerySchema,
  toolStatusSchema,
  updateToolBodySchema
} from "@toolshare/shared/contracts/request/tools.schema";

const routeEnvelope = <TBody extends z.ZodTypeAny>(body: TBody) =>
  z.object({
    body,
    params: z.object({}),
    query: z.object({})
  });

export const listToolsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: listToolsQuerySchema
});

export const toolIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const toolOwnerBlockParamSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid(),
    bookingId: z.string().uuid()
  }),
  query: z.object({})
});

export const createToolSchema = routeEnvelope(createToolBodySchema);

export const updateToolSchema = z.object({
  body: updateToolBodySchema,
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export { toolStatusSchema };
