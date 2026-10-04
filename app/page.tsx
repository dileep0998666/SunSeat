"use client";
import { useState, useRef, FormEvent } from "react";

type Place = { label: string; lat: number; lng: number };
type Data = {
  distanceKm: number; durationMin: number; durationSource: "ticket" | "estimate";
  leftSunMinutes: number; rightSunMinutes: number; recommendation: "left" | "right" | "either";
  bins: { left: number; right: number }[];
};

const fmt = (min: number) => `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
const box = { padding: 10, borderRadius: 8, border: "1px solid #8886", fontSize: 16, width: "100%", boxSizing: "border-box" as const };

function PlaceInput({ placeholder, value, onChange }: { placeholder: string; value: Place | null; onChange: (p: Place | null) => void }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  function type(v: string) {
    setText(v); onChange(null); clearTimeout(timer.current);
    if (v.trim().length < 3) { setOptions([]); return; }
    timer.current = setTimeout(async () => {
      const id = ++seq.current;
      const res = await fetch(`/api/places?q=${encodeURIComponent(v)}`);
      if (res.ok && id === seq.current) { setOptions(await res.json()); setOpen(true); }
    }, 300);
  }

  return (
    <div style={{ position: "relative" }}>
      <input style={{ ...box, borderColor: value ? "#16a34a" : "#8886" }} placeholder={placeholder} value={text}
        onChange={(e) => type(e.target.value)} onFocus={() => options.length && setOpen(true)} onBlur={() => setOpen(false)} />
      {open && options.length > 0 && (
        <ul style={{ position: "absolute", zIndex: 10, left: 0, right: 0, margin: "4px 0 0", padding: 0, listStyle: "none",
          background: "Canvas", color: "CanvasText", border: "1px solid #8886", borderRadius: 8, overflow: "hidden", boxShadow: "0 6px 20px #0003" }}>
          {options.map((o) => (
            <li key={o.label} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #8882" }}
              onMouseDown={(e) => { e.preventDefault(); setText(o.label); onChange(o); setOpen(false); }}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Strip({ label, values, minutes }: { label: string; values: number[]; minutes: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, marginBottom: 4 }}>{label}: <b>{fmt(minutes)}</b> in direct sun</div>
      <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", border: "1px solid #8884" }}>
        {values.map((v, i) => <div key={i} style={{ flex: 1, background: `rgba(245,158,11,${Math.min(1, v * 1.6)})` }} />)}
      </div>
    </div>
  );
}

export default function Home() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [when, setWhen] = useState("");
  const [arrive, setArrive] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setData(null);
    if (!origin || !destination) { setError("Pick both places from the suggestion list."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin, destination,
          departure: new Date(when).toISOString(),
          arrival: arrive ? new Date(arrive).toISOString() : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setData(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally { setBusy(false); }
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>
      <h1 style={{ marginBottom: 4 }}>☀️ SunSeat</h1>
      <p style={{ marginTop: 0, opacity: 0.7 }}>Find the bus side that stays out of the sun.</p>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <PlaceInput placeholder="From" value={origin} onChange={setOrigin} />
        <PlaceInput placeholder="To" value={destination} onChange={setDestination} />
        <label style={{ fontSize: 13, opacity: 0.7 }}>Departure
          <input style={box} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
        </label>
        <label style={{ fontSize: 13, opacity: 0.7 }}>Arrival on your ticket (optional, makes timing exact)
          <input style={box} type="datetime-local" value={arrive} onChange={(e) => setArrive(e.target.value)} />
        </label>
        <button disabled={busy} style={{ ...box, background: "#f59e0b", color: "#000", border: "none", fontWeight: 600, cursor: "pointer" }}>
          {busy ? "Calculating…" : "Find my seat"}
        </button>
      </form>

      {error && <p style={{ color: "#dc2626" }}>{error}</p>}

      {data && (
        <section style={{ marginTop: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {data.recommendation === "either" ? "Either side works" : `Sit on the ${data.recommendation.toUpperCase()} side`}
          </div>
          <p style={{ opacity: 0.7, fontSize: 14 }}>
            {Math.round(data.distanceKm)} km · {fmt(data.durationMin)} {data.durationSource === "ticket" ? "(from your ticket)" : "(estimated for a bus)"} · left = your left when facing forward
          </p>
          <Strip label="Left side" values={data.bins.map((b) => b.left)} minutes={data.leftSunMinutes} />
          <Strip label="Right side" values={data.bins.map((b) => b.right)} minutes={data.rightSunMinutes} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.6 }}><span>Departure</span><span>Arrival</span></div>
        </section>
      )}
    </main>
  );
}
