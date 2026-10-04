import { analyzeRoute, LatLng } from "../lib/sunseat";

// Rough straight-line stand-in for a Hyderabad -> Bengaluru route (heads south-southwest).
// In the real app these points come from a routing API polyline.
function line(a: LatLng, b: LatLng, n: number): LatLng[] {
  return Array.from({ length: n + 1 }, (_, i) => ({
    lat: a.lat + ((b.lat - a.lat) * i) / n,
    lng: a.lng + ((b.lng - a.lng) * i) / n,
  }));
}

const route = line(
  { lat: 17.385, lng: 78.4867 },
  { lat: 12.9716, lng: 77.5946 },
  200
);

// IST = UTC+5:30
const cases: [string, string][] = [
  ["Morning  07:00 IST", "2026-10-05T07:00:00+05:30"],
  ["Midday   11:00 IST", "2026-10-05T11:00:00+05:30"],
  ["Evening  15:00 IST", "2026-10-05T15:00:00+05:30"],
];

for (const [label, iso] of cases) {
  const r = analyzeRoute(route, new Date(iso), 8 * 3600);
  console.log(
    `${label} | left sun: ${r.leftSunMinutes.toFixed(0)} min, right sun: ${r.rightSunMinutes.toFixed(0)} min` +
      ` of ${r.totalMinutes} | sit: ${r.recommendation.toUpperCase()}`
  );
}
