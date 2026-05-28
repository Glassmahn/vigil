import { Request, Response, NextFunction } from "express";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.VIGIL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "VIGIL_API_KEY not configured on server" });
  }
  const provided = req.headers["x-api-key"] as string | undefined;
  if (!provided || provided !== apiKey) {
    return res.status(401).json({ error: "Unauthorized — missing or invalid x-api-key header" });
  }
  next();
}
