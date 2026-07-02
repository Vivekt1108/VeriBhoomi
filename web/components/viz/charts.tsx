"use client";

// Hand-rolled SVG data-viz primitives for VeriBhoomi.
// No charting library — these are small, fully styled to the cartographic
// theme, and animate in with Framer Motion. Reused across every dashboard.

import { useEffect, useState, type ReactNode } from "react";
import { motion, useMotionValue, animate } from "framer-motion";

// ---------------------------------------------------------------------------
// CountUp — animates a number from 0 to its value. The little "tick up" feel.
// ---------------------------------------------------------------------------
export function CountUp({ value, duration = 1.1 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const mv = useMotionValue(0);
  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration, mv]);
  return <>{display.toLocaleString("en-IN")}</>;
}

// ---------------------------------------------------------------------------
// StatTile — the big-number cards across the top of each dashboard.
// ---------------------------------------------------------------------------
export function StatTile({
  label,
  value,
  suffix,
  accent = "#1B2A41",
  icon,
  delay = 0,
  hint,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  accent?: string;
  icon?: ReactNode;
  delay?: number;
  hint?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-md border border-ink/10 bg-parchment p-5 shadow-raised"
    >
      {/* accent rail */}
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-ink-faint">{label}</span>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <div className="mt-3 font-serif text-4xl font-semibold text-ink">
        {typeof value === "number" ? <CountUp value={value} /> : value}
        {suffix && <span className="ml-1 text-lg text-ink-faint">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// DonutChart — status breakdown. Animated arc segments.
// ---------------------------------------------------------------------------
export interface Segment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ segments, size = 180 }: { segments: Segment[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = size / 2 - 16;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(27,42,65,0.08)" strokeWidth="16" />
        {segments.map((s) => {
          const frac = s.value / total;
          const dash = frac * C;
          const offset = -acc * C;
          acc += frac;
          if (s.value === 0) return null;
          return (
            <motion.circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeLinecap="butt"
              strokeDasharray={`${dash} ${C - dash}`}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-ink-soft">{s.label}</span>
            <span className="font-semibold text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BarChart — horizontal bars (e.g. properties per taluk, flagged overlaid).
// ---------------------------------------------------------------------------
export interface Bar {
  label: string;
  value: number;
  sub?: number; // a second value drawn as an overlay (e.g. flagged)
}

export function BarChart({ bars, color = "#1B2A41", subColor = "#B5532A" }: { bars: Bar[]; color?: string; subColor?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="space-y-3">
      {bars.map((b, i) => (
        <div key={b.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-ink-soft">{b.label}</span>
            <span className="text-ink-faint">
              {b.value}
              {b.sub ? <span className="text-terracotta"> · {b.sub} flagged</span> : null}
            </span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-ink/8">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${(b.value / max) * 100}%` }}
              transition={{ delay: i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
            {b.sub ? (
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: subColor }}
                initial={{ width: 0 }}
                animate={{ width: `${(b.sub / max) * 100}%` }}
                transition={{ delay: i * 0.06 + 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — tiny trend line. Used in stat headers.
// ---------------------------------------------------------------------------
export function Sparkline({ data, color = "#B5532A", width = 120, height = 36 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / span) * (height - 4) - 2}`);
  const path = `M ${pts.join(" L ")}`;
  const area = `${path} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <motion.path d={area} fill={color} opacity={0.1}
        initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} transition={{ duration: 0.8 }} />
      <motion.path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeOut" }} />
    </svg>
  );
}
