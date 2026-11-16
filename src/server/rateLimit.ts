import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  timestamps: number[];
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function createRateLimiter(options: {
  name: string;
  windowMs: number;
  maxRequests: number;
}) {
  const store = new Map<string, RateLimitEntry>();
  stores.set(options.name, store);

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "local";

    const entry = store.get(clientIp) || { timestamps: [] };
    entry.timestamps = entry.timestamps.filter((t) => now - t < options.windowMs);

    if (entry.timestamps.length >= options.maxRequests) {
      return res.status(429).json({
        error: "Rate limit exceeded. Please wait a few seconds before sending another request.",
      });
    }

    entry.timestamps.push(now);
    store.set(clientIp, entry);
    next();
  };
}
