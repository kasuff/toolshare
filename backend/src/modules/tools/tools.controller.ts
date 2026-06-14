import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { toolsService } from "./tools.service";

export const toolsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const tools = await toolsService.list({
      category: req.query.category as string | undefined,
      status: req.query.status as "AVAILABLE" | "REQUESTED" | "BORROWED" | undefined,
      ownerId: req.query.ownerId as string | undefined,
      search: req.query.search as string | undefined
    });
    res.status(200).json(tools);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const tool = await toolsService.getById(req.params.id);
    res.status(200).json(tool);
  }),

  listBlockingPeriods: asyncHandler(async (req: Request, res: Response) => {
    const periods = await toolsService.listBlockingPeriods(req.params.id);
    res.status(200).json(
      periods.map((period) => ({
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString()
      }))
    );
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const tool = await toolsService.create({
      ownerId: req.authUser!.userId,
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      imageUrl: req.body.imageUrl,
      pickupLocation: req.body.pickupLocation,
      pickupLocationNote: req.body.pickupLocationNote
    });
    res.status(201).json(tool);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const tool = await toolsService.update({
      toolId: req.params.id,
      actorId: req.authUser!.userId,
      actorRole: req.authUser!.role,
      data: {
        name: req.body.name,
        description: req.body.description,
        category: req.body.category,
        imageUrl: req.body.imageUrl,
        pickupLocation: req.body.pickupLocation,
        pickupLocationNote: req.body.pickupLocationNote,
        status: req.body.status
      }
    });
    res.status(200).json(tool);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await toolsService.remove({
      toolId: req.params.id,
      actorId: req.authUser!.userId,
      actorRole: req.authUser!.role
    });
    res.status(204).send();
  })
};
