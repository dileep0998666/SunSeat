import { NextRequest, NextResponse } from "next/server";
import { analyzeRoute, LatLng } from "@/lib/sunseat";

const OSRM = process.env.OSRM_URL ?? "https://router.project-osrm.org";
// OSRM gives free-flow *car* time. Intercity buses are slower (speed limits, stops, traffic).
const BUS_FACTOR = Number(process.env.BUS_SPEED_FACTOR ?? 1.35);

type Place = { label: string; lat: number; lng: number };
const valid = (p: Place | undefined) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

export async function POST(req: NextRequest) {
  try {
    const { origin, destination, departure, arrival } = await req.json();
    const when = new Date(departure);
    if (!valid(origin) || !valid(destination) || isNaN(when.getTime())) {
      return NextResponse.json({ error: "Pick both places from the suggestions and set a departure time" }, { status: 400 });
    }

    const url = `${OSRM}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const rj = await (await fetch(url)).json();
    if (rj.code !== "Ok") throw new Error("No driving route found between those places");
    const route = rj.routes[0];
    const points: LatLng[] = route.geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng }));

    // Prefer the real duration from the ticket; otherwise estimate bus time.
    let durationSec = route.duration * BUS_FACTOR;
    let durationSource: "ticket" | "estimate" = "estimate";
    if (arrival) {
      const d = (new Date(arrival).getTime() - when.getTime()) / 1000;
      if (d > 600) { durationSec = d; durationSource = "ticket"; }
    }

    const r = analyzeRoute(points, when, durationSec);

    const N = 96;
    const bins = Array.from({ length: N }, () => ({ left: 0, right: 0, w: 0 }));
    for (const s of r.segments) {
      const i = Math.min(N - 1, Math.floor(((s.startMin + s.endMin) / 2 / r.totalMinutes) * N));
      const d = s.endMin - s.startMin;
      bins[i].left += s.left * d; bins[i].right += s.right * d; bins[i].w += d;
    }

    return NextResponse.json({
      distanceKm: route.distance / 1000,
      durationMin: r.totalMinutes,
      durationSource,
      leftSunMinutes: r.leftSunMinutes,
      rightSunMinutes: r.rightSunMinutes,
      recommendation: r.recommendation,
      bins: bins.map((x) => ({ left: x.w ? x.left / x.w : 0, right: x.w ? x.right / x.w : 0 })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong" }, { status: 500 });
  }
}
