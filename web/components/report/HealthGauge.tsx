"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";

// Circular gauge that counts the score up from 0 — the "score reveal" moment.
export function HealthGauge({ score }: { score: number }) {
  const [display, setDisplay] = useState(0);
  const mv = useMotionValue(0);

  useEffect(() => {
    const controls = animate(mv, score, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [score, mv]);

  const band = score >= 75 ? "LOW" : score >= 45 ? "MEDIUM" : "HIGH";
  const color = band === "LOW" ? "#2F5D44" : band === "MEDIUM" ? "#B8893B" : "#B5532A";

  const R = 70;
  const C = 2 * Math.PI * R;
  const offset = C - (display / 100) * C;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-44 w-44">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(27,42,65,0.12)" strokeWidth="10" />
          <motion.circle
            cx="80" cy="80" r={R} fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-5xl font-semibold text-ink">{display}</span>
          <span className="text-xs uppercase tracking-widest text-ink-faint">/ 100</span>
        </div>
      </div>
      <span
        className="mt-3 rounded-sm px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white"
        style={{ backgroundColor: color }}
      >
        {band} risk
      </span>
    </div>
  );
}
