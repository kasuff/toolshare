import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { toolsService } from "./tools.service";
import {
  toToolBlockingPeriodResponseList,
  toToolOwnerBlockResponseList,
  toToolResponse,
  toToolResponseList
} from "./tools.presenter";

export const toolsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const tools = await toolsService.list({
      category: req.query.category as string | undefined,
      status: req.query.status as "AVAILABLE" | "REQUESTED" | "BORROWED" | undefined,
      ownerId: req.query.ownerId as string | undefined,
      search: req.query.search as string | undefined
    });
    res.status(200).json(toToolResponseList(tools));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const tool = await toolsService.getById(req.params.id);
    res.status(200).json(toToolResponse(tool));
  }),

  listBlockingPeriods: asyncHandler(async (req: Request, res: Response) => {
    const periods = await toolsService.listBlockingPeriods(req.params.id);
    res.status(200).json(toToolBlockingPeriodResponseList(periods));
  }),

  listOwnerBlocks: asyncHandler(async (req: Request, res: Response) => {
    const blocks = await toolsService.listOwnerBlocks(req.params.id, req.authUser!.userId);
    res.status(200).json(toToolOwnerBlockResponseList(blocks));
  }),

  deleteOwnerBlock: asyncHandler(async (req: Request, res: Response) => {
    await toolsService.deleteOwnerBlock({
      toolId: req.params.id,
      bookingId: req.params.bookingId,
      actorId: req.authUser!.userId
    });
    res.status(204).send();
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
    res.status(201).json(toToolResponse(tool));
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
    res.status(200).json(toToolResponse(tool));
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
