import http from "node:http";
import { config } from "./config.js";
import { assertRegion, buildFeed, getCatalog, parseList, searchTeams } from "./feedService.js";

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (req.method === "OPTIONS") {
      return sendNoContent(res);
    }
    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    if (url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, upstream: config.vlrApiBaseUrl });
    }
    if (url.pathname === "/api/catalog") {
      return sendJson(res, 200, await getCatalog());
    }
    if (url.pathname === "/api/search/teams") {
      return sendJson(res, 200, { teams: await searchTeams(url.searchParams.get("q") || "") });
    }

    if (url.pathname === "/api/feeds/all.ics") {
      return sendIcs(res, await buildFeed("all", { feedUrl: externalUrl(req) }));
    }
    if (url.pathname === "/api/feeds/masters-champions.ics") {
      return sendIcs(res, await buildFeed("masters-champions", { feedUrl: externalUrl(req) }));
    }
    const regionMatch = url.pathname.match(/^\/api\/feeds\/regions\/([a-z-]+)\.ics$/);
    if (regionMatch) {
      const region = regionMatch[1];
      assertRegion(region);
      return sendIcs(res, await buildFeed("region", { region, feedUrl: externalUrl(req) }));
    }
    const teamMatch = url.pathname.match(/^\/api\/feeds\/teams\/(.+)\.ics$/);
    if (teamMatch) {
      const team = decodeURIComponent(teamMatch[1]);
      return sendIcs(res, await buildFeed("team", { teams: [team], feedUrl: externalUrl(req) }));
    }
    if (url.pathname === "/api/feeds/custom.ics") {
      return sendIcs(res, await buildFeed("custom", {
        regions: parseList(url.searchParams.get("regions")),
        teams: parseList(url.searchParams.get("teams")),
        events: parseList(url.searchParams.get("events")),
        feedUrl: externalUrl(req)
      }));
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const status = error.statusCode || 502;
    return sendJson(res, status, { error: error.message || "Unexpected error" });
  }
});

server.listen(config.port, () => {
  console.log(`VLR ICS API listening on ${config.port}`);
});

function sendNoContent(res) {
  res.writeHead(204, corsHeaders());
  res.end();
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    ...corsHeaders(),
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendIcs(res, body) {
  res.writeHead(200, {
    ...corsHeaders(),
    "content-type": "text/calendar; charset=utf-8",
    "content-disposition": "inline",
    "cache-control": "public, max-age=300"
  });
  res.end(body);
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

function externalUrl(req) {
  const rawUrl = req.url || "";
  return `${config.publicBaseUrl}${rawUrl}`;
}
