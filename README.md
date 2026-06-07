# VLR Esports ICS

Auto-updating iCalendar feeds for Valorant esports matches using the V2 `vlrggapi` API.

## Feeds

- `GET /api/feeds/all.ics` - all upcoming matches
- `GET /api/feeds/masters-champions.ics` - Masters and Champions matches
- `GET /api/feeds/regions/:region.ics` - one feed per VLR region code
- `GET /api/feeds/teams/:team.ics` - team-specific feed, where `:team` can be a VLR team id or team name
- `GET /api/feeds/custom.ics?regions=na,eu&teams=Sentinels,G2%20Esports&events=masters,champions` - custom feed

Region codes: `na`, `eu`, `ap`, `la`, `la-s`, `la-n`, `oce`, `kr`, `mn`, `gc`, `br`, `cn`, `jp`, `col`.

The feeds update automatically because every calendar request refreshes data from VLR through a short server-side cache. No static `.ics` files need to be regenerated.

For auto-updates, users should subscribe to the feed URL in their calendar app. Downloading an `.ics` file is usually a one-time import and may not refresh future matches.

Google Calendar subscription guide: https://www.usecarly.com/blog/how-to/how-to-subscribe-to-calendar-google/

GitHub:

- https://github.com/reazndev
- https://github.com/reazndev/vlr-esport-calendar

## Local Development

```bash
docker compose -f docker-compose.dev.yml up --build
```

Open `http://localhost:8080`.

API health:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/feeds/all.ics
```

## Production

The default `docker-compose.yml` is production-oriented and pulls GHCR images built by the `Prod Build` GitHub Actions workflow on pushes to the `prod` branch.

```bash
docker compose pull
docker compose up -d
```

Default production port: `8050`. Override it with `WEB_PORT`.

```bash
PUBLIC_BASE_URL=https://your-domain.example WEB_PORT=8050 docker compose up -d
```

## Configuration

Environment variables for the API:

- `PORT` - default `3000`
- `PUBLIC_BASE_URL` - public URL used by the frontend when composing subscription links
- `VLR_API_BASE_URL` - default `https://vlrggapi.vercel.app`
- `CACHE_TTL_MS` - normal feed cache TTL, default `300000`
- `CATALOG_CACHE_TTL_MS` - catalog cache TTL, default `1800000`
- `UPCOMING_PAGES` - pages requested from `/v2/match?q=upcoming_extended`, default `3`
- `EVENT_PAGES` - pages requested from `/v2/events`, default `3`

## API Source

This app uses `https://vlrggapi.vercel.app` and its V2 endpoints. The upstream docs recommend V2, list `/v2/match`, `/v2/events`, `/v2/events/matches`, `/v2/team`, and `/v2/search`, and document VLR region codes.
