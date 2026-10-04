# SunSeat

Tells you which side of a bus (left/right) to sit on to avoid direct sun, from origin, destination and departure time.

## Run
    npm install
    npm run dev        # http://localhost:3000
    npm test           # engine sanity check on a synthetic route

## Deploy
Push to GitHub and import into Vercel. No env vars needed for the prototype.

## How it works
- `app/api/analyze/route.ts`: geocodes with Nominatim, routes with OSRM, calls the engine, returns a 96-bin timeline.
- `lib/sunseat.ts`: per-segment bus heading + sun position (suncalc) -> exposure per side.

## Before launching publicly
- Nominatim and the OSRM demo server are for light use only. Self-host OSRM (set `OSRM_URL`) and switch geocoding to a paid or self-hosted provider.
- Add caching (same route + hour) and rate limiting on `/api/analyze`.
- Tune the roof-blocking cutoff (70 deg) in `lib/sunseat.ts` against real trips.
