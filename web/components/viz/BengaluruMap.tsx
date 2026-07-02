"use client";

// A lightweight, dependency-free map of Bengaluru.
// We don't pull in a tiles/Leaflet stack — instead we project each property's
// lat/lng into an SVG viewport drawn over a stylised "survey sheet" backdrop
// (graticule + a soft city outline). Pins are colour-coded by status, flagged
// ones pulse, and clicking a pin selects the property.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export interface MapPin {
  id: string;
  surveyNo: string;
  village: string;
  status: "CLEAR" | "UNDER_REVIEW" | "DISPUTED" | "FLAGGED";
  lat: number;
  lng: number;
  score: number | null;
}

const statusColor: Record<string, string> = {
  CLEAR: "#2F5D44",
  UNDER_REVIEW: "#B8893B",
  DISPUTED: "#7A1F1F",
  FLAGGED: "#B5532A",
};

// Bengaluru rough bounding box (lng = x, lat = y). Padded a little.
const BBOX = { minLng: 77.45, maxLng: 77.75, minLat: 12.86, maxLat: 13.28 };

export function BengaluruMap({
  pins,
  onSelect,
  selectedId,
}: {
  pins: MapPin[];
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}) {
  const [hover, setHover] = useState<MapPin | null>(null);
  const W = 640, H = 480;

  const project = useMemo(() => {
    const { minLng, maxLng, minLat, maxLat } = BBOX;
    return (lat: number, lng: number) => ({
      x: ((lng - minLng) / (maxLng - minLng)) * W,
      // invert lat so north is up
      y: H - ((lat - minLat) / (maxLat - minLat)) * H,
    });
  }, []);

  return (
    <div className="relative overflow-hidden rounded-md border border-ink/10 bg-parchment-dark/30 shadow-raised">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" style={{ minHeight: 360 }}>
        <defs>
          <radialGradient id="mapglow" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#F4EEE2" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E8DFCC" stopOpacity="0.2" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#mapglow)" />

        {/* graticule / survey grid */}
        {Array.from({ length: 13 }).map((_, i) => (
          <line key={`v${i}`} x1={(i * W) / 12} y1={0} x2={(i * W) / 12} y2={H} stroke="rgba(27,42,65,0.06)" strokeWidth={1} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={(i * H) / 9} x2={W} y2={(i * H) / 9} stroke="rgba(27,42,65,0.06)" strokeWidth={1} />
        ))}

        {/* stylised city outline — a soft blob, purely decorative */}
        <path
          d="M120,150 C160,90 280,70 360,90 C460,115 540,140 540,220 C545,300 470,360 380,390 C300,415 190,410 140,350 C95,295 80,210 120,150 Z"
          fill="rgba(47,93,68,0.06)"
          stroke="rgba(27,42,65,0.18)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        {/* a faux river */}
        <path d="M90,300 C200,260 300,330 420,290 C500,262 560,300 600,280" fill="none" stroke="rgba(27,42,65,0.12)" strokeWidth={3} strokeLinecap="round" />

        {/* compass rose */}
        <g transform={`translate(${W - 48}, 48)`} opacity={0.5}>
          <circle r={18} fill="none" stroke="rgba(27,42,65,0.3)" strokeWidth={1} />
          <path d="M0,-16 L4,0 L0,16 L-4,0 Z" fill="#B5532A" />
          <text y={-22} textAnchor="middle" fontSize="9" fill="#34435A" fontWeight="700">N</text>
        </g>

        {/* pins */}
        {pins.map((p, i) => {
          const { x, y } = project(p.lat, p.lng);
          const color = statusColor[p.status] ?? "#34435A";
          const flagged = p.status === "FLAGGED" || p.status === "DISPUTED";
          const selected = selectedId === p.id;
          return (
            <motion.g
              key={p.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.05, type: "spring", stiffness: 260, damping: 18 }}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(p.id)}
            >
              {/* pulsing ring for flagged/disputed */}
              {flagged && (
                <circle cx={x} cy={y} r={8} fill="none" stroke={color} strokeWidth={2}>
                  <animate attributeName="r" from="8" to="22" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="2.2s" repeatCount="indefinite" />
                </circle>
              )}
              {selected && <circle cx={x} cy={y} r={14} fill="none" stroke={color} strokeWidth={2} />}
              <circle cx={x} cy={y} r={selected ? 8 : 6} fill={color} stroke="#F4EEE2" strokeWidth={2} />
            </motion.g>
          );
        })}
      </svg>

      {/* hover tooltip */}
      {hover && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-sm border border-ink/15 bg-parchment/95 px-3 py-2 text-xs shadow-ledger">
          <div className="font-serif text-sm text-ink">{hover.surveyNo}</div>
          <div className="text-ink-soft">{hover.village}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: statusColor[hover.status] }} />
            <span className="uppercase tracking-wider text-ink-faint">{hover.status.replace(/_/g, " ")}</span>
            {hover.score !== null && <span className="text-ink">· {hover.score}/100</span>}
          </div>
        </div>
      )}

      {/* legend */}
      <div className="absolute bottom-3 right-3 flex flex-wrap gap-2 rounded-sm border border-ink/10 bg-parchment/90 px-3 py-2 text-[10px] uppercase tracking-wider text-ink-soft">
        {Object.entries(statusColor).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: v }} /> {k.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    </div>
  );
}
