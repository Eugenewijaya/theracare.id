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
    deviceId: firstHeaderValue(req.headers["x-theracare-device-id"]).trim().slice(0, 160),
    deviceLabel: firstHeaderValue(req.headers["x-theracare-device-label"]).trim().slice(0, 160),
    deviceScreen: firstHeaderValue(req.headers["x-theracare-device-screen"]).trim().slice(0, 80),
    deviceTimezone: firstHeaderValue(req.headers["x-theracare-device-timezone"]).trim().slice(0, 120),
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

  const androidModel = userAgent.match(/Android[^;)]*;\s*([^;)]+?)(?:\s+Build|\)|;)/i)?.[1]?.trim();
  const deviceModel = /iphone/.test(ua)
    ? "iPhone"
    : /ipad/.test(ua)
      ? "iPad"
      : /mac os|macintosh/.test(ua)
        ? "Mac"
        : /windows/.test(ua)
          ? "Windows PC"
          : androidModel || (/android/.test(ua) ? "Android device" : deviceType);
  const deviceVendor = /iphone|ipad|mac os|macintosh/.test(ua)
    ? "Apple"
    : /samsung|sm-|gt-|galaxy/.test(ua)
      ? "Samsung"
      : /huawei|honor/.test(ua)
        ? "Huawei"
        : /xiaomi|redmi|poco/.test(ua)
          ? "Xiaomi"
          : /oppo/.test(ua)
            ? "OPPO"
            : /vivo/.test(ua)
              ? "Vivo"
              : /windows/.test(ua)
                ? "Microsoft/PC"
                : "Unknown";
  const deviceName = [deviceVendor !== "Unknown" ? deviceVendor : "", deviceModel].filter(Boolean).join(" ").trim() || deviceType;

  return { deviceType, os, browser, deviceName, deviceModel, deviceVendor };
}
