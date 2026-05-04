import type { Response } from "express";

export function ok(res: Response, data: any, message?: string) {
  return res.json({ success: true, data, message });
}

export function created(res: Response, data: any, message?: string) {
  return res.status(201).json({ success: true, data, message });
}

export function badRequest(res: Response, message: string) {
  return res.status(400).json({ success: false, error: message });
}

export function notFound(res: Response, message = "Data tidak ditemukan") {
  return res.status(404).json({ success: false, error: message });
}
