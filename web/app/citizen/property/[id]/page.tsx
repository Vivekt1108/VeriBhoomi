"use client";

// CITIZEN TRUST REPORT — the sanitised, reassuring public view of a property.
// Shows a verdict, an animated trust gauge, plain-language flags, and a way to
// request an official verification. Deliberately hides the forensic detail
// (party names, case numbers, lenders) that only officers should see.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ShieldCheck, ShieldAlert, ShieldQuestion, FileText, Scale,
  Landmark, Users, AlertOctagon, AlertTriangle, CheckCircle2, Send,
  Sparkles, ScrollText, FileCheck2, ReceiptText, FileWarning, Stamp, ScanLine,
} from "lucide-react";
import { RoleShell } from "@/components/shell/RoleShell";
import { HealthGauge } from "@/components/report/HealthGauge";
import { DocViewer } from "@/components/report/DocViewer";
import { CountUp } from "@/components/viz/charts";
import { api } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";

interface DocOut {
  id: string; type: string; label: string; purpose: string;
  confidence: number; confidenceNote: string;
  fields: { key: string; value: string }[];
  hasFile: boolean; status: string;
}
interface Dossier {
  headline: string;
  points: { tone: "good" | "warn" | "bad" | "info"; text: string }[];
  documents: DocOut[];
}
interface TrustReport {
  id: string; surveyNo: string; khataNo: string; area: number;
  village: string; taluk: string; district: string; status: string;
  score: number | null; band: string; verdict: string; advice: string;
  currentOwner: string | null;
  counts: { critical: number; warning: number; owners: number; liens: number; disputes: number; documents: number };
  flags: { severity: string; title: string; verified: boolean }[];
  dossier: Dossier;
}

// icon + accent per document type
const docMeta: Record<string, { icon: typeof FileText; color: string }> = {
  SALE_DEED:        { icon: ScrollText,  color: "#1B2A41" },
  MUTATION:         { icon: FileCheck2,  color: "#2F5D44" },
  TAX_RECEIPT:      { icon: ReceiptText, color: "#B8893B" },
  ENCUMBRANCE_CERT: { icon: FileWarning, color: "#B5532A" },
  GOVT_APPROVAL:    { icon: Stamp,       color: "#7A1F1F" },
};

// tone → colour for the smart-summary bullet points
const toneStyle: Record<string, { color: string; dot: string }> = {
  good: { color: "#2F5D44", dot: "#2F5D44" },
  warn: { color: "#B8893B", dot: "#B8893B" },
  bad:  { color: "#B5532A", dot: "#B5532A" },
  info: { color: "#34435A", dot: "#6B7689" },
};

// pretty-print an extracted field key: "titleStatus" -> "Title status"
const prettyKey = (k: string) =>
  k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/_/g, " ");

const bandStyle: Record<string, { color: string; icon: typeof ShieldCheck; bg: string }> = {
  LOW: { color: "#2F5D44", icon: ShieldCheck, bg: "from-forest/15" },
  MEDIUM: { color: "#B8893B", icon: ShieldQuestion, bg: "from-gold/15" },
  HIGH: { color: "#B5532A", icon: ShieldAlert, bg: "from-terracotta/15" },
  UNKNOWN: { color: "#6B7689", icon: ShieldQuestion, bg: "from-ink/10" },
};

export default function CitizenReport() {
  return (
    <RoleShell role="CITIZEN">
      <ReportInner />
    </RoleShell>
  );
}

function ReportInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<TrustReport | null>(null);
  const [modal, setModal] = useState(false);
  const [purpose, setPurpose] = useState("PURCHASE");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  useEffect(() => {
    api<TrustReport>(`/api/public/property/${id}`).then(setReport).catch(() => {});
  }, [id]);

  async function submitRequest() {
    setSubmitting(true);
    try {
      await api("/api/requests", { method: "POST", body: JSON.stringify({ propertyId: id, purpose, note }) });
      setSent(true);
      setTimeout(() => { setModal(false); setSent(false); }, 1600);
    } finally {
      setSubmitting(false);
    }
  }

  if (!report) return <p className="text-ink-soft">Loading report…</p>;

  const b = bandStyle[report.band] ?? bandStyle.UNKNOWN;
  const Icon = b.icon;

  return (
    <div className="space-y-8">
      <button onClick={() => router.push("/citizen")} className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to search
      </button>

      {/* ---------- VERDICT BANNER ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className={`relative overflow-hidden rounded-xl border border-ink/10 bg-gradient-to-br ${b.bg} via-parchment to-parchment p-8 shadow-raised`}
      >
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-[0.18em] text-ink-faint">
              {report.surveyNo} · {report.village}, {report.taluk}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-lg" style={{ background: b.color }}>
                <Icon className="h-6 w-6 text-parchment" />
              </span>
              <h1 className="font-serif text-3xl font-semibold text-ink md:text-4xl">{report.verdict}</h1>
            </div>
            <p className="mt-3 max-w-2xl text-ink-soft">{report.advice}</p>

            <button
              onClick={() => setModal(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-parchment shadow-ledger transition hover:opacity-90"
              style={{ background: b.color }}
            >
              <Send className="h-4 w-4" /> Request an official verification
            </button>
          </div>

          {report.score !== null && (
            <div className="shrink-0">
              <HealthGauge score={report.score} />
            </div>
          )}
        </div>
      </motion.section>

      {/* ---------- AT-A-GLANCE COUNTS ---------- */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Documents", value: report.counts.documents, icon: FileText, color: "#34435A" },
          { label: "Owners on record", value: report.counts.owners, icon: Users, color: "#34435A" },
          { label: "Loans / liens", value: report.counts.liens, icon: Landmark, color: report.counts.liens ? "#B5532A" : "#2F5D44" },
          { label: "Court disputes", value: report.counts.disputes, icon: Scale, color: report.counts.disputes ? "#7A1F1F" : "#2F5D44" },
          { label: "Critical flags", value: report.counts.critical, icon: AlertOctagon, color: report.counts.critical ? "#B5532A" : "#2F5D44" },
          { label: "Warnings", value: report.counts.warning, icon: AlertTriangle, color: report.counts.warning ? "#B8893B" : "#2F5D44" },
        ].map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-lg border border-ink/10 bg-parchment p-4 shadow-ledger"
          >
            <c.icon className="h-5 w-5" style={{ color: c.color }} />
            <div className="mt-2 font-serif text-2xl font-semibold text-ink"><CountUp value={c.value} /></div>
            <div className="text-[11px] uppercase tracking-wider text-ink-faint">{c.label}</div>
          </motion.div>
        ))}
      </section>

      {/* ---------- PLAIN-LANGUAGE FLAGS ---------- */}
      <section>
        <h2 className="font-serif text-2xl text-ink">What we found</h2>
        {report.flags.length === 0 ? (
          <p className="mt-4 rounded-lg border border-forest/30 bg-forest/5 p-5 text-sm text-forest">
            {report.score === null
              ? "This property hasn't been analysed yet. Request a verification to get a full report."
              : "No contradictions were found in the available records. Still verify the seller's identity before paying."}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {report.flags.map((f, i) => {
              const color = f.severity === "CRITICAL" ? "#B5532A" : f.severity === "WARNING" ? "#B8893B" : "#34435A";
              const FIcon = f.severity === "CRITICAL" ? AlertOctagon : f.severity === "WARNING" ? AlertTriangle : CheckCircle2;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                  className="flex items-start gap-3 rounded-lg border-l-4 bg-parchment p-4 shadow-ledger"
                  style={{ borderLeftColor: color }}
                >
                  <FIcon className="mt-0.5 h-5 w-5 shrink-0" style={{ color }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-serif text-ink">{f.title}</h4>
                      {f.verified && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-ink">
                          <CheckCircle2 className="h-3 w-3 text-gold" /> Officer-confirmed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-faint">
                      For your safety, the full details are shared with the verifying officer.
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- SMART SUMMARY ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="rounded-xl border border-ink/10 bg-gradient-to-br from-ink/[0.03] to-parchment p-6 shadow-raised"
      >
        <div className="flex items-center gap-2 text-ink-soft">
          <Sparkles className="h-4 w-4 text-gold" />
          <span className="text-xs font-medium uppercase tracking-[0.18em]">In plain language</span>
        </div>
        <p className="mt-3 max-w-3xl font-serif text-xl leading-relaxed text-ink">{report.dossier.headline}</p>

        {report.dossier.points.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {report.dossier.points.map((p, i) => {
              const t = toneStyle[p.tone] ?? toneStyle.info;
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }}
                  className="flex items-start gap-3 text-sm"
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: t.dot }} />
                  <span className="leading-relaxed" style={{ color: t.color }}>{p.text}</span>
                </motion.li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-[11px] text-ink-faint">
          Generated from the records on file. This is guidance, not a legal opinion — request an officer’s verification before paying.
        </p>
      </motion.section>

      {/* ---------- DOCUMENT DOSSIER ---------- */}
      <section>
        <h2 className="font-serif text-2xl text-ink">Documents on record</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The papers attached to this plot, and what each one tells us. Names are masked for privacy — an officer sees the full detail.
        </p>

        {report.dossier.documents.length === 0 ? (
          <p className="mt-4 rounded-lg border border-ink/10 bg-parchment p-5 text-sm text-ink-soft shadow-ledger">
            No documents are on record for this plot yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {report.dossier.documents.map((d, i) => {
              const m = docMeta[d.type] ?? { icon: FileText, color: "#34435A" };
              const DIcon = m.icon;
              const confColor = d.confidence >= 0.95 ? "#2F5D44" : d.confidence >= 0.85 ? "#B8893B" : "#B5532A";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex flex-col rounded-xl border border-ink/10 bg-parchment p-5 shadow-ledger"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: `${m.color}14` }}>
                        <DIcon className="h-5 w-5" style={{ color: m.color }} />
                      </span>
                      <div>
                        <h3 className="font-serif text-lg leading-tight text-ink">{d.label}</h3>
                        <p className="text-xs text-ink-faint">{d.purpose}</p>
                      </div>
                    </div>
                  </div>

                  {/* extracted fields */}
                  {d.fields.length > 0 && (
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-ink/5 pt-4 text-sm">
                      {d.fields.map((f) => (
                        <div key={f.key}>
                          <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{prettyKey(f.key)}</dt>
                          <dd className="text-ink">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {/* OCR confidence badge + view-document toggle */}
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink/5 pt-3">
                    <span className="flex items-center gap-2 text-[11px]" style={{ color: confColor }}>
                      <ScanLine className="h-3.5 w-3.5" />
                      {d.confidenceNote} · {Math.round(d.confidence * 100)}% read confidence
                    </span>
                    {d.hasFile ? (
                      <button
                        onClick={() => setOpenDoc(openDoc === d.id ? null : d.id)}
                        className="inline-flex items-center gap-1.5 rounded-sm border border-ink/20 px-2.5 py-1 text-xs text-ink transition hover:bg-ink hover:text-parchment"
                      >
                        {openDoc === d.id ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> View document</>}
                      </button>
                    ) : (
                      <span className="text-[11px] text-ink-faint">No scan attached</span>
                    )}
                  </div>

                  <AnimatePresence>
                    {openDoc === d.id && <DocViewer documentId={d.id} />}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- REQUEST MODAL ---------- */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
            onClick={() => !submitting && setModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-xl border border-ink/10 bg-parchment p-6 shadow-raised"
            >
              {sent ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <CheckCircle2 className="h-12 w-12 text-forest" />
                  <h3 className="mt-3 font-serif text-xl text-ink">Request sent</h3>
                  <p className="mt-1 text-sm text-ink-soft">An officer in {report.district} will pick it up. Track it under “My requests”.</p>
                </div>
              ) : (
                <>
                  <h3 className="font-serif text-xl text-ink">Request official verification</h3>
                  <p className="mt-1 text-sm text-ink-soft">{report.surveyNo} · {report.village}</p>

                  <label className="mt-4 block text-sm text-ink-soft">Why are you checking this?</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      { v: "PURCHASE", l: "Buying it" },
                      { v: "LOAN", l: "Bank loan" },
                      { v: "INHERITANCE", l: "Inheritance" },
                      { v: "GENERAL", l: "Just checking" },
                    ].map((p) => (
                      <button
                        key={p.v}
                        onClick={() => setPurpose(p.v)}
                        className="rounded-sm border px-3 py-2 text-sm transition"
                        style={{
                          borderColor: purpose === p.v ? "#2F5D44" : "rgba(27,42,65,0.2)",
                          background: purpose === p.v ? "rgba(47,93,68,0.08)" : "transparent",
                          color: purpose === p.v ? "#2F5D44" : "#34435A",
                        }}
                      >
                        {p.l}
                      </button>
                    ))}
                  </div>

                  <label className="mt-4 block text-sm text-ink-soft">Anything the officer should know?</label>
                  <textarea
                    value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                    placeholder="e.g. Seller wants the advance this week."
                    className="mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 text-sm outline-none focus:border-forest"
                  />

                  <div className="mt-5 flex justify-end gap-3">
                    <button onClick={() => setModal(false)} className="rounded-sm border border-ink/20 px-4 py-2 text-sm text-ink hover:bg-ink/5">Cancel</button>
                    <button
                      onClick={submitRequest} disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-sm bg-forest px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" /> {submitting ? "Sending…" : "Send request"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
