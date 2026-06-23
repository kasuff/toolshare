import { z } from "zod";

const workshopToolSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1)
});

export const listWorkshopsQuerySchema = z.object({
  managerId: z.string().uuid().optional(),
  location: z.string().min(1).optional(),
  search: z.string().min(1).optional()
});

export const createWorkshopBodySchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
  location: z.string().min(2),
  maxCapacity: z.number().int().min(1),
  extras: z.array(z.string().min(1)).optional(),
  equipment: z.array(z.string().min(1)).optional(),
  workshopTools: z.array(workshopToolSchema).optional(),
  imageUrls: z.array(z.string().min(1)).optional()
});

export const updateWorkshopBodySchema = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().min(5).optional(),
    location: z.string().min(2).optional(),
    maxCapacity: z.number().int().min(1).optional(),
    extras: z.array(z.string().min(1)).optional(),
    equipment: z.array(z.string().min(1)).optional(),
    workshopTools: z.array(workshopToolSchema).optional(),
    imageUrls: z.array(z.string().min(1)).optional()
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.location !== undefined ||
      value.maxCapacity !== undefined ||
      value.extras !== undefined ||
      value.equipment !== undefined ||
      value.workshopTools !== undefined ||
      value.imageUrls !== undefined,
    { message: "Mindestens ein Feld muss angegeben werden." }
  );

export const createTimeslotBodySchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  blockedByOwner: z.boolean().optional()
});

export const updateTimeslotBodySchema = z
  .object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    blockedByOwner: z.boolean().optional()
  })
  .refine(
    (value) => value.startTime !== undefined || value.endTime !== undefined || value.blockedByOwner !== undefined,
    { message: "Mindestens ein Feld muss angegeben werden." }
  );

export type ListWorkshopsQuery = z.infer<typeof listWorkshopsQuerySchema>;
export type CreateWorkshopBody = z.infer<typeof createWorkshopBodySchema>;
export type UpdateWorkshopBody = z.infer<typeof updateWorkshopBodySchema>;
export type CreateTimeslotBody = z.infer<typeof createTimeslotBodySchema>;
export type UpdateTimeslotBody = z.infer<typeof updateTimeslotBodySchema>;
