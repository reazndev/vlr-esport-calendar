export const config = {
  port: Number(process.env.PORT || 3030),
  publicBaseUrl: stripTrailingSlash(process.env.PUBLIC_BASE_URL || "http://localhost:8050"),
  vlrApiBaseUrl: stripTrailingSlash(process.env.VLR_API_BASE_URL || "https://vlrggapi.vercel.app"),
  cacheTtlMs: Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000),
  catalogCacheTtlMs: Number(process.env.CATALOG_CACHE_TTL_MS || 30 * 60 * 1000),
  upcomingPages: Number(process.env.UPCOMING_PAGES || 3),
  eventPages: Number(process.env.EVENT_PAGES || 3),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 15000)
};

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}
