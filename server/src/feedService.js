import { cached } from "./cache.js";
import { config } from "./config.js";
import { EVENT_FILTERS, REGIONS, REGION_CODES } from "./constants.js";
import { renderCalendar } from "./ics.js";
import {
  eventMatches,
  isMastersOrChampions,
  normalizeEvent,
  normalizeTeamSearchResult,
  normalizeUpcomingMatch,
  teamMatches
} from "./normalizers.js";
import { VlrClient } from "./vlrClient.js";

const client = new VlrClient();

export async function getCatalog() {
  return cached("catalog", config.catalogCacheTtlMs, async () => {
    const [events, matches, rankedTeams] = await Promise.all([fetchEvents(), getUpcomingMatches(), fetchRankedTeams()]);
    const teams = collectTeams(matches, rankedTeams);
    return {
      regions: REGIONS,
      eventFilters: EVENT_FILTERS.map(({ id, name }) => ({ id, name })),
      events,
      teams,
      feeds: {
        all: "/api/feeds/all.ics",
        mastersChampions: "/api/feeds/masters-champions.ics",
        custom: "/api/feeds/custom.ics"
      },
      generatedAt: new Date().toISOString()
    };
  });
}

export async function searchTeams(query) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) {
    return [];
  }

  const catalog = await getCatalog();
  const localTeams = catalog.teams
    .filter((team) => normalizeSearch(team.name).includes(normalizedQuery) || normalizeSearch(team.tag).includes(normalizedQuery))
    .slice(0, 30);

  const upstreamTeams = await cached(`search:${normalizedQuery}`, config.cacheTtlMs, async () => {
    const data = await client.get("/v2/search", { q: query.trim() });
    const teams = data?.segments?.results?.teams || data?.results?.teams || [];
    return teams.map(normalizeTeamSearchResult).filter((team) => team.name);
  }).catch(() => []);

  return dedupeTeams([...localTeams, ...upstreamTeams])
    .sort((a, b) => scoreTeam(a, normalizedQuery) - scoreTeam(b, normalizedQuery) || a.name.localeCompare(b.name))
    .slice(0, 30);
}

export async function buildFeed(kind, options = {}) {
  const matches = await getUpcomingMatches();
  const resolvedOptions = await resolveOptions(options);
  const filtered = filterMatches(matches, kind, resolvedOptions);
  const feedUrl = options.feedUrl || "";
  return renderCalendar({
    name: feedName(kind, resolvedOptions),
    description: "Valorant esports matches from vlr.gg via vlrggapi.",
    url: feedUrl,
    matches: filtered
  });
}

export async function getUpcomingMatches() {
  return cached("matches:upcoming", config.cacheTtlMs, async () => {
    const events = await fetchEvents();
    const eventRegionMap = new Map(events.map((event) => [event.name.trim().toLowerCase(), event.region]).filter(([, region]) => region));
    const data = await client.get("/v2/match", {
      q: "upcoming_extended",
      num_pages: config.upcomingPages
    });
    const segments = data?.segments || [];
    return segments
      .map((segment) => normalizeUpcomingMatch(segment, eventRegionMap))
      .filter(Boolean);
  });
}

async function fetchEvents() {
  return cached("events:active", config.catalogCacheTtlMs, async () => {
    const requests = [];
    for (const q of ["upcoming", "live"]) {
      for (let page = 1; page <= config.eventPages; page += 1) {
        requests.push(client.get("/v2/events", { q, page }).catch(() => ({ segments: [] })));
      }
    }
    const pages = await Promise.all(requests);
    const byIdOrName = new Map();
    for (const page of pages) {
      for (const segment of page?.segments || []) {
        const event = normalizeEvent(segment);
        byIdOrName.set(event.id || event.name, event);
      }
    }
    return Array.from(byIdOrName.values()).sort((a, b) => a.name.localeCompare(b.name));
  });
}

async function fetchRankedTeams() {
  return cached("teams:rankings", config.catalogCacheTtlMs, async () => {
    const pages = await Promise.all(
      REGIONS.map((region) => client.get("/v2/rankings", { region: region.code }).catch(() => ({ segments: [] })))
    );
    const teams = [];
    for (const page of pages) {
      const rows = page?.segments || page?.data || [];
      for (const row of rows) {
        const name = row.team || row.name;
        if (name && !/^(tbd|to be decided)$/i.test(name)) {
          teams.push({
            name,
            tag: row.country || "",
            logo: row.logo || ""
          });
        }
      }
    }
    return dedupeTeams(teams);
  });
}

async function resolveOptions(options) {
  const teams = await Promise.all((options.teams || []).map(resolveTeamInput));
  return {
    ...options,
    teams: teams.filter(Boolean)
  };
}

async function resolveTeamInput(team) {
  const value = String(team || "").trim();
  if (!/^\d+$/.test(value)) {
    return value;
  }
  const data = await cached(`team:${value}:profile`, config.catalogCacheTtlMs, () => client.get("/v2/team", { id: value, q: "profile" }));
  return data?.info?.name || value;
}

function filterMatches(matches, kind, options) {
  if (kind === "all") {
    return matches;
  }
  if (kind === "masters-champions") {
    return matches.filter(isMastersOrChampions);
  }
  if (kind === "region") {
    return matches.filter((match) => match.region === options.region);
  }
  if (kind === "team") {
    return matches.filter((match) => teamMatches(match, options.teams || []));
  }
  if (kind === "custom") {
    const regions = options.regions || [];
    const teams = options.teams || [];
    const events = options.events || [];
    return matches.filter((match) => {
      const regionOk = !regions.length || regions.includes(match.region);
      return regionOk && teamMatches(match, teams) && eventMatches(match, events);
    });
  }
  return [];
}

function collectTeams(matches, rankedTeams = []) {
  const teams = new Map();
  for (const team of rankedTeams) {
    teams.set(normalizeSearch(team.name), team);
  }
  for (const match of matches) {
    for (const team of match.teams) {
      if (!/^(tbd|to be decided)$/i.test(team)) {
        teams.set(normalizeSearch(team), { name: team });
      }
    }
  }
  return Array.from(teams.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function feedName(kind, options) {
  if (kind === "all") {
    return "Valorant Esports - All Matches";
  }
  if (kind === "masters-champions") {
    return "Valorant Esports - Masters and Champions";
  }
  if (kind === "region") {
    const region = REGIONS.find((item) => item.code === options.region);
    return `Valorant Esports - ${region?.name || options.region}`;
  }
  if (kind === "team") {
    return `Valorant Esports - ${(options.teams || []).join(", ")}`;
  }
  return "Valorant Esports - Custom Feed";
}

export function parseList(value) {
  if (!value) {
    return [];
  }
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

export function assertRegion(region) {
  if (!REGION_CODES.has(region)) {
    const error = new Error(`Invalid region '${region}'.`);
    error.statusCode = 400;
    throw error;
  }
}

function dedupeTeams(teams) {
  const byName = new Map();
  for (const team of teams) {
    const key = normalizeSearch(team.name);
    if (!key || byName.has(key)) {
      continue;
    }
    byName.set(key, team);
  }
  return Array.from(byName.values());
}

function scoreTeam(team, query) {
  const name = normalizeSearch(team.name);
  const tag = normalizeSearch(team.tag);
  if (name === query || tag === query) {
    return 0;
  }
  if (name.startsWith(query) || tag.startsWith(query)) {
    return 1;
  }
  return 2;
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}
