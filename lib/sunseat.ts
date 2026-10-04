import { getPosition } from "suncalc";

export type LatLng = { lat: number; lng: number };

export interface Segment {
  startMin: number;   // minutes since departure
  endMin: number;
  heading: number;    // bus compass heading, degrees
  sunAzimuth: number; // compass degrees (0 = north, clockwise)
  sunAltitude: number; // degrees above horizon
  left: number;       // exposure intensity 0..1
  right: number;
}

export interface Result {
  leftSunMinutes: number;
  rightSunMinutes: number;
  leftScore: number;   // intensity-weighted minutes
  rightScore: number;
  totalMinutes: number;
  recommendation: "left" | "right" | "either";
  segments: Segment[];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

// Smallest signed angle difference a - b, in (-180, 180]
function angleDiff(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

// Intensity of sun through a side window: 0..1
function windowExposure(
  windowFacing: number,
  sunAz: number,
  sunAlt: number
): number {
  if (sunAlt <= 0) return 0;
  const c = Math.cos(rad(angleDiff(sunAz, windowFacing)));
  if (c <= 0) return 0;
  // High sun is blocked by the roof; low sun streams in.
  const elevFactor = Math.max(0, 1 - sunAlt / 70);
  return c * elevFactor;
}

const SUN_THRESHOLD = 0.25; // intensity above which we count "in direct sun"

export function analyzeRoute(
  points: LatLng[],
  departure: Date,
  durationSec: number
): Result {
  // cumulative distance along the route
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
  }
  const total = cum[cum.length - 1];
  if (total === 0) throw new Error("Route has zero length");

  const segments: Segment[] = [];
  let leftSun = 0, rightSun = 0, leftScore = 0, rightScore = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const segDist = cum[i] - cum[i - 1];
    if (segDist < 1) continue; // skip duplicate points

    const startMin = ((cum[i - 1] / total) * durationSec) / 60;
    const endMin = ((cum[i] / total) * durationSec) / 60;
    const midMin = (startMin + endMin) / 2;
    const dur = endMin - startMin;

    const mid: LatLng = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const t = new Date(departure.getTime() + midMin * 60000);

    const pos = getPosition(t, mid.lat, mid.lng);
    // suncalc v2: degrees, azimuth clockwise from north (compass), altitude above horizon
    const sunAz = pos.azimuth;
    const sunAlt = pos.altitude;

    const heading = bearing(a, b);
    const right = windowExposure((heading + 90) % 360, sunAz, sunAlt);
    const left = windowExposure((heading + 270) % 360, sunAz, sunAlt);

    leftScore += left * dur;
    rightScore += right * dur;
    if (left > SUN_THRESHOLD) leftSun += dur;
    if (right > SUN_THRESHOLD) rightSun += dur;

    segments.push({
      startMin, endMin, heading,
      sunAzimuth: sunAz, sunAltitude: sunAlt, left, right,
    });
  }

  const totalMinutes = durationSec / 60;
  const diff = leftScore - rightScore;
  // "either" if the sides differ by less than 5% of the trip
  const recommendation =
    Math.abs(diff) < totalMinutes * 0.05
      ? "either"
      : diff > 0 ? "right" : "left";

  return {
    leftSunMinutes: leftSun, rightSunMinutes: rightSun,
    leftScore, rightScore, totalMinutes, recommendation, segments,
  };
}
