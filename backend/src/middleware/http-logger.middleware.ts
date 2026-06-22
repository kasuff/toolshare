import { randomUUID } from "node:crypto";
import pinoHttp from "pino-http";
import type { Request } from "express";
import { logger } from "../config/logger";
import { REQUEST_ID_HEADER } from "./request-id.middleware";

export const httpLogger = pinoHttp({
  logger,
  customProps: (req) => ({
    requestId: (req as Request).requestId
  }),
  customReceivedMessage: (req) => `${req.method} ${req.url}`,
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  genReqId: (req) => {
    const expressReq = req as Request;
    return expressReq.header(REQUEST_ID_HEADER) ?? expressReq.requestId ?? randomUUID();
  }
});
