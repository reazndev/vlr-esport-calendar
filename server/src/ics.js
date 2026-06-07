export function renderCalendar({ name, description, url, matches }) {
  const now = formatIcsDate(new Date());
  const events = matches
    .slice()
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((match) => renderEvent(match, now))
    .join("");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VLR Esports ICS//Valorant Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-CALDESC:${escapeText(description)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    url ? `URL:${escapeText(url)}` : "",
    events,
    "END:VCALENDAR",
    ""
  ].filter(Boolean).join("\r\n");
}

function renderEvent(match, now) {
  const summary = `${match.team1} vs ${match.team2}`;
  const description = [
    match.eventName,
    match.series,
    match.region ? `Region: ${match.region}` : "",
    match.url
  ].filter(Boolean).join("\\n");

  return [
    "BEGIN:VEVENT",
    `UID:vlr-${match.id}@vlr-esports-ics`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsDate(match.startsAt)}`,
    `DTEND:${formatIcsDate(match.endsAt)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(match.eventName)}`,
    match.url ? `URL:${escapeText(match.url)}` : "",
    "END:VEVENT"
  ].filter(Boolean).join("\r\n") + "\r\n";
}

function formatIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
