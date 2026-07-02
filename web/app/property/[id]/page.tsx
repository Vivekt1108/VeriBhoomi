"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Landmark } from "lucide-react";
import { api, getUser, type SessionUser } from "@/lib/api";
import { HealthGauge } from "@/components/report/HealthGauge";
import { FindingCard, type Finding } from "@/components/report/FindingCard";
import { RelationshipGraph } from "@/components/report/RelationshipGraph";
import { DocumentManager, type ManagedDoc } from "@/components/report/DocumentManager";

// the full property payload (loose typing — backend returns nested relations)
interface FullProperty {
  id: string;
  surveyNo: string;
  khataNo: string;
  area: number;
  village: string;
  taluk: string;
  district: string;
  status: string;
  ownerships: any[];
  encumbrances: any[];
  disputes: any[];
  inheritances: any[];
  taxRecords: any[];
  documents: ManagedDoc[];
  findings: Finding[];
  healthScores: { score: number }[];
}

export default function PropertyReport() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [property, setProperty] = useState<FullProperty | null>(null);
  const [highlight, setHighlight] = useState<string[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewing, setReviewing] = useState<Finding | null>(null);
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    api<FullProperty>(`/api/properties/${id}`).then(setProperty).catch(() => {});
  }, [id]);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);
    load();
  }, [id, router, load]);

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      await api(`/api/properties/${id}/analyze`, { method: "POST" });
      load();
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitReview(verified: boolean) {
    if (!reviewing) return;
    await api(`/api/findings/${reviewing.id}/verify`, {
      method: "PATCH",
      body: JSON.stringify({ humanVerified: verified, expertNotes: notes }),
    });
    setReviewing(null);
    setNotes("");
    load();
  }

  if (!property) {
    return <main className="flex min-h-screen items-center justify-center text-ink-soft">Loading report…</main>;
  }

  const score = property.healthScores[0]?.score ?? null;
  const canVerify = user?.role === "OFFICER" || user?.role === "AUTHORITY";

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink/10 bg-parchment">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-ink-soft hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Register
          </Link>
          <div className="flex items-center gap-2 text-ink">
            <Landmark className="h-5 w-5" />
            <span className="text-sm uppercase tracking-[0.2em]">VeriBhoomi</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* title */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-ink">{property.surveyNo}</h1>
            <p className="mt-1 text-ink-soft">
              {property.village}, {property.taluk}, {property.district} · {property.area} sq ft · Khata {property.khataNo}
            </p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="inline-flex items-center gap-2 rounded-sm bg-terracotta px-5 py-2.5 text-parchment shadow-ledger transition hover:bg-terracotta-soft disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {analyzing ? "Analysing…" : "Run fraud analysis"}
          </button>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">
          {/* left: gauge + score breakdown */}
          <div className="space-y-6">
            <div className="rounded-sm border border-ink/10 bg-parchment p-6 shadow-ledger">
              <h3 className="mb-4 text-sm uppercase tracking-[0.2em] text-ink-faint">Property health</h3>
              {score !== null ? (
                <HealthGauge score={score} />
              ) : (
                <p className="text-center text-sm text-ink-soft">
                  Not analysed yet. Run the fraud analysis to compute a score.
                </p>
              )}
            </div>

            {/* documents — list, upload (with conflict warning), supersede history */}
            <DocumentManager
              propertyId={property.id}
              documents={property.documents}
              canEdit={canVerify}
              onChange={load}
            />
          </div>

          {/* right: relationship graph + findings */}
          <div className="space-y-8">
            <div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-ink-faint">Relationship web</h3>
              <RelationshipGraph property={property as any} highlightIds={highlight} />
              <p className="mt-2 text-xs text-ink-faint">Hover a finding below to highlight the records that triggered it.</p>
            </div>

            <div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-ink-faint">
                Findings ({property.findings.length})
              </h3>
              <div className="space-y-3">
                {property.findings.map((f, i) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    index={i}
                    onHover={setHighlight}
                    canVerify={canVerify}
                    onVerify={(finding) => { setReviewing(finding); setNotes(finding.expertNotes ?? ""); }}
                  />
                ))}
                {property.findings.length === 0 && (
                  <p className="rounded-sm border border-forest/30 bg-forest/5 p-4 text-sm text-forest">
                    No risks found. This property appears clean based on available records.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* officer review modal */}
      <AnimatePresence>
        {reviewing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
            onClick={() => setReviewing(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-sm border border-ink/10 bg-parchment p-6 shadow-ledger"
            >
              <h3 className="font-serif text-xl text-ink">Review finding</h3>
              <p className="mt-1 text-sm font-medium text-ink">{reviewing.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{reviewing.description}</p>

              <label className="mt-4 block text-sm text-ink-soft">Officer notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Confirmed against registry; encumbrance still open."
                className="mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 text-sm outline-none focus:border-terracotta"
              />

              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => submitReview(false)} className="rounded-sm border border-ink/20 px-4 py-2 text-sm text-ink hover:bg-ink/5">
                  Override (dismiss)
                </button>
                <button onClick={() => submitReview(true)} className="rounded-sm bg-gold px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                  Verify finding
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
