import app from "../src/index.js";

const PATH_PARAM = "__theracare_path";

function rewriteRequestUrl(req: { url?: string }) {
  const currentUrl = req.url || "/";
  const parsed = new URL(currentUrl, "http://127.0.0.1");
  const routePath = parsed.searchParams.get(PATH_PARAM);

  if (routePath === null) return;

  parsed.searchParams.delete(PATH_PARAM);
  const normalizedPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
  const query = parsed.searchParams.toString();
  req.url = `/api${normalizedPath}${query ? `?${query}` : ""}`;
}

export default function handler(req: any, res: any) {
  rewriteRequestUrl(req);
  return app(req, res);
}
