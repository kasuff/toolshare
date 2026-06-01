import { z } from "zod";

const toolStatusSchema = z.enum(["AVAILABLE", "REQUESTED", "BORROWED"]);

export const listToolsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    category: z.string().min(1).optional(),
    status: toolStatusSchema.optional(),
    ownerId: z.string().uuid().optional(),
    search: z.string().min(1).optional()
  })
});

export const toolIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const createToolSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().min(5),
    category: z.string().min(2),
    imageUrl: z.string().min(1).optional(),
    pickupLocation: z.string().min(5),
    pickupLocationNote: z.string().max(300).optional()
  }),
  params: z.object({}),
  query: z.object({})
});

export const updateToolSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).optional(),
      description: z.string().min(5).optional(),
      category: z.string().min(2).optional(),
      imageUrl: z.string().min(1).optional(),
      pickupLocation: z.string().min(5).optional(),
      pickupLocationNote: z.string().max(300).optional(),
      status: toolStatusSchema.optional()
    })
    .refine(
      (value) =>
        value.name !== undefined ||
        value.description !== undefined ||
        value.category !== undefined ||
        value.imageUrl !== undefined ||
        value.pickupLocation !== undefined ||
        value.pickupLocationNote !== undefined ||
        value.status !== undefined,
      {
        message: "At least one field must be provided"
      }
    ),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});