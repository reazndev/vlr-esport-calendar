export const REGIONS = [
  { code: "na", name: "North America" },
  { code: "eu", name: "Europe" },
  { code: "ap", name: "Asia Pacific" },
  { code: "la", name: "Latin America" },
  { code: "la-s", name: "Latin America South" },
  { code: "la-n", name: "Latin America North" },
  { code: "oce", name: "Oceania" },
  { code: "kr", name: "Korea" },
  { code: "mn", name: "MENA" },
  { code: "gc", name: "Game Changers" },
  { code: "br", name: "Brazil" },
  { code: "cn", name: "China" },
  { code: "jp", name: "Japan" },
  { code: "col", name: "Collegiate" }
];

export const REGION_CODES = new Set(REGIONS.map((region) => region.code));

export const EVENT_FILTERS = [
  { id: "masters", name: "Masters", pattern: /masters/i },
  { id: "champions", name: "Champions", pattern: /champions/i }
];
