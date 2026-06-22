import { z } from "zod";

export const toolStatusSchema = z.enum(["AVAILABLE", "REQUESTED", "BORROWED"]);

export const createToolBodySchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
  category: z.string().min(2),
  imageUrl: z.string().min(1).optional(),
  pickupLocation: z.string().min(5),
  pickupLocationNote: z.string().max(300).optional()
});

export const updateToolBodySchema = z
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
    { message: "Mindestens ein Feld muss angegeben werden." }
  );

export const listToolsQuerySchema = z.object({
  category: z.string().min(1).optional(),
  status: toolStatusSchema.optional(),
  ownerId: z.string().uuid().optional(),
  search: z.string().min(1).optional()
});

export type CreateToolBody = z.infer<typeof createToolBodySchema>;
export type UpdateToolBody = z.infer<typeof updateToolBodySchema>;
