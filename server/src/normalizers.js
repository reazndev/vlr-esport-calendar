import { EVENT_FILTERS, REGION_CODES } from "./constants.js";

const COUNTRY_TO_REGION = new Map([
  ["us", "na"], ["ca", "na"],
  ["gb", "eu"], ["de", "eu"], ["fr", "eu"], ["es", "eu"], ["it", "eu"], ["nl", "eu"], ["pl", "eu"], ["se", "eu"], ["tr", "eu"],
  ["br", "br"],
  ["cl", "la-s"], ["ar", "la-s"], ["pe", "la-s"], ["co", "la-n"], ["mx", "la-n"],
  ["kr", "kr"],
  ["cn", "cn"],
  ["jp", "jp"],
  ["au", "oce"], ["nz", "oce"],
  ["sg", "ap"], ["ph", "ap"], ["id", "ap"], ["th", "ap"], ["vn", "ap"], ["my", "ap"], ["in", "ap"],
  ["sa", "mn"], ["ae", "mn"], ["eg", "mn"], ["ma", "mn"]
]);

export function normalizeUpcomingMatch(segment, eventRegionMap = new Map()) {
  const startsAt = parseVlrDate(segment.unix_timestamp);
  if (!startsAt) {
    return null;
  }

  const eventName = segment.match_event || segment.tournament_name || segment.event || "Valorant Esports";
  const series = segment.match_series || segment.round_info || "";
  const url = absoluteVlrUrl(segment.match_page);
  const teams = [segment.team1, segment.team2].filter(Boolean);
  const region = inferRegion(segment, eventName, eventRegionMap);
  const id = extractMatchId(url) || stableId([startsAt.toISOString(), ...teams, eventName].join("|"));

  return {
    id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
    team1: segment.team1 || "TBD",
    team2: segment.team2 || "TBD",
    teams,
    eventName,
    series,
    region,
    url,
    source: segment
  };
}

export function normalizeEvent(segment) {
  const id = extractEventId(segment.url_path);
  const region = REGION_CODES.has(segment.region) ? segment.region : "";
  return {
    id,
    name: segment.title || "Untitled event",
    status: segment.status || "",
    region,
    dates: segment.dates || "",
    url: absoluteVlrUrl(segment.url_path)
  };
}

export function normalizeTeamSearchResult(team) {
  return {
    id: String(team.id || ""),
    name: team.name || "",
    tag: team.tag || "",
    description: team.description || "",
    inactive: /\binactive\b/i.test(`${team.tag || ""} ${team.description || ""}`),
    logo: absoluteAssetUrl(team.img || team.logo || "")
  };
}

export function isMastersOrChampions(match) {
  return EVENT_FILTERS.some((filter) => filter.pattern.test(match.eventName));
}

export function parseVlrDate(value) {
  if (!value) {
    return null;
  }
  const raw = String(value).trim();
  if (/^\d{10}$/.test(raw)) {
    return new Date(Number(raw) * 1000);
  }
  if (/^\d{13}$/.test(raw)) {
    return new Date(Number(raw));
  }
  const isoish = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsed = new Date(isoish.endsWith("Z") ? isoish : `${isoish}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function teamMatches(match, requestedTeams) {
  if (!requestedTeams.length) {
    return true;
  }
  const names = match.teams.map((team) => normalizeToken(team));
  return requestedTeams.some((team) => names.includes(normalizeToken(team)));
}

export function eventMatches(match, requestedEvents) {
  if (!requestedEvents.length) {
    return true;
  }
  const eventName = normalizeToken(match.eventName);
  return requestedEvents.some((event) => {
    const token = normalizeToken(event);
    const builtIn = EVENT_FILTERS.find((filter) => filter.id === token);
    return builtIn ? builtIn.pattern.test(match.eventName) : eventName.includes(token);
  });
}

function inferRegion(segment, eventName, eventRegionMap) {
  const mapped = eventRegionMap.get(normalizeToken(eventName));
  if (mapped) {
    return mapped;
  }

  const lower = eventName.toLowerCase();
  const nameHints = [
    [/americas|north america|\bna\b/, "na"],
    [/emea|europe|\beu\b/, "eu"],
    [/pacific|asia pacific|\bapac\b/, "ap"],
    [/latin america|latam/, "la"],
    [/brazil|\bbr\b/, "br"],
    [/china|\bcn\b/, "cn"],
    [/japan|\bjp\b/, "jp"],
    [/korea|\bkr\b/, "kr"],
    [/oceania|\boce\b/, "oce"],
    [/mena|\bmn\b/, "mn"],
    [/game changers|\bgc\b/, "gc"],
    [/collegiate/, "col"]
  ];
  for (const [pattern, region] of nameHints) {
    if (pattern.test(lower)) {
      return region;
    }
  }

  for (const flag of [segment.flag1, segment.flag2]) {
    const country = String(flag || "").replace(/^flag_/, "").toLowerCase();
    if (COUNTRY_TO_REGION.has(country)) {
      return COUNTRY_TO_REGION.get(country);
    }
  }

  return "global";
}

function absoluteVlrUrl(value) {
  if (!value) {
    return "";
  }
  if (String(value).startsWith("http")) {
    return value;
  }
  return `https://www.vlr.gg${String(value).startsWith("/") ? "" : "/"}${value}`;
}

function absoluteAssetUrl(value) {
  if (!value) {
    return "";
  }
  if (String(value).startsWith("//")) {
    return `https:${value}`;
  }
  return String(value);
}

function extractMatchId(url) {
  return String(url || "").match(/vlr\.gg\/(\d+)/)?.[1] || "";
}

function extractEventId(url) {
  return String(url || "").match(/\/event\/(\d+)/)?.[1] || "";
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

function stableId(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return String(hash);
}
