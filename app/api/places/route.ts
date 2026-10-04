import { NextRequest, NextResponse } from "next/server";

// Autocomplete via Photon (OpenStreetMap-based, built for type-ahead). Swap this one file
// for Google Places / Mapbox / Ola Maps when you launch; the UI doesn't change.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json([]);
  try {
    // lat/lon softly bias results toward central India without excluding other places
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lat=21&lon=79&location_bias_scale=0.3`;
    const res = await fetch(url, { headers: { "User-Agent": "sunseat/0.1 (personal project)" } });
    if (!res.ok) return NextResponse.json([]);
    const j = await res.json();
    const seen = new Set<string>();
    const out: { label: string; lat: number; lng: number }[] = [];
    for (const f of j.features ?? []) {
      const p = f.properties ?? {};
      const [lng, lat] = f.geometry.coordinates;
      const parts = [p.name ?? p.street, p.city ?? p.district ?? p.county, p.state].filter(Boolean);
      const label = parts.filter((x: string, i: number) => parts.indexOf(x) === i).join(", ");
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push({ label, lat, lng });
    }
    return NextResponse.json(out);
  } catch {
    return NextResponse.json([]);
  }
}
