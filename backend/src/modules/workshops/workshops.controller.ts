import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { workshopsService } from "./workshops.service";

export const workshopsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const workshops = await workshopsService.list({
      managerId: req.query.managerId as string | undefined,
      location: req.query.location as string | undefined,
      search: req.query.search as string | undefined
    });
    res.status(200).json(workshops);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const workshop = await workshopsService.getById(req.params.id);
    res.status(200).json(workshop);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const workshop = await workshopsService.create({
      managerId: req.authUser!.userId,
      name: req.body.name,
      description: req.body.description,
      location: req.body.location,
      maxCapacity: req.body.maxCapacity
    });
    res.status(201).json(workshop);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const workshop = await workshopsService.update({
      workshopId: req.params.id,
      managerId: req.authUser!.userId,
      actorRole: req.authUser!.role,
      data: {
        name: req.body.name,
        description: req.body.description,
        location: req.body.location,
        maxCapacity: req.body.maxCapacity
      }
    });
    res.status(200).json(workshop);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await workshopsService.remove({
      workshopId: req.params.id,
      managerId: req.authUser!.userId,
      actorRole: req.authUser!.role
    });
    res.status(204).send();
  }),

  createTimeslot: asyncHandler(async (req: Request, res: Response) => {
    const timeslot = await workshopsService.createTimeslot({
      workshopId: req.params.id,
      managerId: req.authUser!.userId,
      actorRole: req.authUser!.role,
      startTime: req.body.startTime,
      endTime: req.body.endTime
    });
    res.status(201).json(timeslot);
  }),

  removeTimeslot: asyncHandler(async (req: Request, res: Response) => {
    await workshopsService.removeTimeslot({
      workshopId: req.params.id,
      timeslotId: req.params.timeslotId,
      managerId: req.authUser!.userId,
      actorRole: req.authUser!.role
    });
    res.status(204).send();
  })
};