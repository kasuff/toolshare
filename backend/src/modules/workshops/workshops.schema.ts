import { z } from "zod";

const workshopToolSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1)
});

export const listWorkshopsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    managerId: z.string().uuid().optional(),
    location: z.string().min(1).optional(),
    search: z.string().min(1).optional()
  })
});

export const workshopIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const createWorkshopSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().min(5),
    location: z.string().min(2),
    maxCapacity: z.number().int().min(1),
    extras: z.array(z.string().min(1)).optional(),
    equipment: z.array(z.string().min(1)).optional(),
    workshopTools: z.array(workshopToolSchema).optional(),
    imageUrls: z.array(z.string().min(1)).optional()
  }),
  params: z.object({}),
  query: z.object({})
});

export const updateWorkshopSchema = z.object({
  body: z
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
      { message: "At least one field must be provided" }
    ),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const createTimeslotSchema = z.object({
  body: z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    blockedByOwner: z.boolean().optional()
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const updateTimeslotSchema = z.object({
  body: z
    .object({
      startTime: z.string().datetime().optional(),
      endTime: z.string().datetime().optional(),
      blockedByOwner: z.boolean().optional()
    })
    .refine(
      (value) => value.startTime !== undefined || value.endTime !== undefined || value.blockedByOwner !== undefined,
      { message: "At least one field must be provided" }
    ),
  params: z.object({
    id: z.string().uuid(),
    timeslotId: z.string().uuid()
  }),
  query: z.object({})
});

export const removeTimeslotSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid(),
    timeslotId: z.string().uuid()
  }),
  query: z.object({})
});