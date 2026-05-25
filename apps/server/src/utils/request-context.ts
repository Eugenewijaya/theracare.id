import type { Request } from "express";

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function cleanIp(value: string) {
  const first = value.split(",")[0]?.trim() || "";
  return first.replace(/^::ffff:/, "").slice(0, 80);
}

export function getClientIp(req: Request) {
  return cleanIp(
    firstHeaderValue(req.headers["cf-connecting-ip"])
    || firstHeaderValue(req.headers["x-real-ip"])
    || firstHeaderValue(req.headers["x-forwarded-for"])
    || req.ip
    || req.socket?.remoteAddress
    || "",
  );
}

export function getUserAgent(req: Request) {
  return firstHeaderValue(req.headers["user-agent"]).slice(0, 500);
}

export function getRequestClientMeta(req: Request) {
  return {
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}

export function parseUserAgent(userAgent = "") {
  const ua = userAgent.toLowerCase();
  const isBot = /bot|crawler|spider|crawling|headless|uptime|monitor/.test(ua);
  const deviceType = isBot
    ? "Bot"
    : /ipad|tablet/.test(ua)
      ? "Tablet"
      : /mobile|iphone|android/.test(ua)
        ? "Mobile"
        : "Desktop";

  const os = /windows/.test(ua)
    ? "Windows"
    : /mac os|macintosh/.test(ua)
      ? "macOS"
      : /iphone|ipad|ios/.test(ua)
        ? "iOS"
        : /android/.test(ua)
          ? "Android"
          : /linux/.test(ua)
            ? "Linux"
            : "Unknown";

  const browser = /edg\//.test(ua)
    ? "Microsoft Edge"
    : /opr\//.test(ua) || /opera/.test(ua)
      ? "Opera"
      : /chrome|crios/.test(ua)
        ? "Chrome"
        : /safari/.test(ua) && !/chrome|crios/.test(ua)
          ? "Safari"
          : /firefox|fxios/.test(ua)
            ? "Firefox"
            : "Unknown";

  return { deviceType, os, browser };
}
