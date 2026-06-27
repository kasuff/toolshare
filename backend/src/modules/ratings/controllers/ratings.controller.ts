import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { ratingsService } from "../services/ratings.service";
import {
  toPublicRatingResponseList,
  toRatingResponse,
  toRatingResponseList
} from "./ratings.presenter";

export const ratingsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const rating = await ratingsService.create({
      bookingId: req.body.bookingId,
      fromUserId: req.authUser!.userId,
      score: req.body.score,
      comment: req.body.comment
    });
    res.status(201).json(toRatingResponse(rating));
  }),

  listMineReceived: asyncHandler(async (req: Request, res: Response) => {
    const ratings = await ratingsService.listReceived(req.authUser!.userId);
    res.status(200).json(toRatingResponseList(ratings));
  }),

  listMineGiven: asyncHandler(async (req: Request, res: Response) => {
    const ratings = await ratingsService.listGiven(req.authUser!.userId);
    res.status(200).json(toRatingResponseList(ratings));
  }),

  listForUser: asyncHandler(async (req: Request, res: Response) => {
    const ratings = await ratingsService.listReceived(req.params.id);
    res.status(200).json(toRatingResponseList(ratings));
  }),

  listForTool: asyncHandler(async (req: Request, res: Response) => {
    const ratings = await ratingsService.listForTool(req.params.toolId);
    res.status(200).json(toPublicRatingResponseList(ratings));
  }),

  listForWorkshop: asyncHandler(async (req: Request, res: Response) => {
    const ratings = await ratingsService.listForWorkshop(req.params.workshopId);
    res.status(200).json(toPublicRatingResponseList(ratings));
  })
};