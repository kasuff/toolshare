import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { ratingsService } from "./ratings.service";

export const ratingsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const rating = await ratingsService.create({
      bookingId: req.body.bookingId,
      fromUserId: req.authUser!.userId,
      toUserId: req.body.toUserId,
      score: req.body.score,
      comment: req.body.comment
    });
    res.status(201).json(rating);
  }),

  listMineReceived: asyncHandler(async (req: Request, res: Response) => {
    const ratings = await ratingsService.listReceived(req.authUser!.userId);
    res.status(200).json(ratings);
  }),

  listMineGiven: asyncHandler(async (req: Request, res: Response) => {
    const ratings = await ratingsService.listGiven(req.authUser!.userId);
    res.status(200).json(ratings);
  }),

  listForUser: asyncHandler(async (req: Request, res: Response) => {
    const ratings = await ratingsService.listReceived(req.params.id);
    res.status(200).json(ratings);
  })
};