import type { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error & { status?: number; details?: unknown },
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = Number(err.status || 500);
  console.error(status >= 500 ? "Server Error:" : "Request Error:", err.message);
  res.status(status).json({
    success: false,
    error: status >= 500 ? "Internal server error" : err.message,
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
    details: process.env.NODE_ENV === "development" ? err.details : undefined,
  });
};
