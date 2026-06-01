import type { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error & { status?: number; details?: unknown; code?: string; constraint?: string },
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const isUniqueViolation = err.code === "23505";
  const status = Number(err.status || (isUniqueViolation ? 409 : 500));
  const requestId = req.get("x-request-id") || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const publicMessage = isUniqueViolation
    ? "Data sudah digunakan oleh record lain. Periksa email, nomor HP, NIT/NITA, atau kode unik yang diisi."
    : status >= 500 ? "Internal server error" : err.message;

  console.error(
    status >= 500 ? "Server Error:" : "Request Error:",
    JSON.stringify({
      requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      message: err.message,
      details: err.details || (isUniqueViolation ? { constraint: err.constraint } : undefined),
    }),
  );

  res.setHeader("x-request-id", requestId);
  res.status(status).json({
    success: false,
    error: publicMessage,
    requestId,
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
    details: status < 500 ? (err.details || (isUniqueViolation ? { constraint: err.constraint } : undefined)) : process.env.NODE_ENV === "development" ? err.details : undefined,
  });
};
