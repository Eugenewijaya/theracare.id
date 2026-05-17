import type { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = Number((err as any).statusCode || (err as any).status || 500);
  const safeStatus = statusCode >= 400 && statusCode < 600 ? statusCode : 500;

  console.error("Server Error:", err.message);
  res.status(safeStatus).json({
    success: false,
    error: safeStatus === 500 ? "Internal server error" : err.message,
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
    data: (err as any).data,
  });
};
