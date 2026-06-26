import { Request, Response, Router } from "express";
import { authenticateToken, requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { inboxController } from "./inbox.controller";
import { addInboxReadReceiptsSchema } from "./inbox.schema";
import { registerConnection, unregisterConnection } from "./inbox.events";

const HEARTBEAT_INTERVAL_MS = 25_000;

export const inboxRouter = Router();

// SSE-Stream: bewusst VOR requireAuth, da EventSource keine Header setzen kann →
// Token via Query-Param, eigene Verifikation. Langlebige Verbindung; der
// error-handler/rate-limiter greifen hier nicht regulär (Header sind schon raus).
inboxRouter.get("/stream", async (req: Request, res: Response) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing token" } });
    return;
  }

  let userId: string;
  try {
    const authUser = await authenticateToken(token);
    userId = authUser.userId;
  } catch {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
    return;
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no" // nginx: Buffering für diese Response abschalten
  });
  res.flushHeaders();
  res.write("retry: 5000\n\n"); // EventSource-Reconnect-Intervall (ms)

  registerConnection(userId, res);

  const heartbeat = setInterval(() => {
    res.write(":ping\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unregisterConnection(userId, res);
  });
});

inboxRouter.use(requireAuth);
inboxRouter.get("/read-receipts", inboxController.getReceipts);
inboxRouter.post(
  "/read-receipts",
  validate(addInboxReadReceiptsSchema),
  inboxController.addReceipts
);
