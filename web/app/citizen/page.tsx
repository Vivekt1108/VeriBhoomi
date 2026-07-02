"use client";

// CITIZEN HOME — a consumer-facing "is this property safe to buy?" experience.
// Nothing like the officer console: a big search, plain-language results, and a
// tracker of the citizen's own verification requests. No register browsing, no
// party names, no forensic web.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShieldCheck, FileSearch, Clock, ArrowRight, MapPin } from "lucide-react";
import { RoleShell, type NavItem } from "@/components/shell/RoleShell";
import { api } from "@/lib/api";

interface SearchHit {
  id: string; surveyNo: string; khataNo: string; area: number;
  village: string; taluk: string; district: string; status: string; latestScore: number | null;
}
interface MyRequest {
  id: string; purpose: string; status: string; note?: string | null; officerNote?: string | null; createdAt: string;
  property: { id: string; surveyNo: string; village: string; taluk: string; district: string; status: string };
  officer?: { name: string } | null;
}

const reqStatusStyle: Record<string, { bg: string; label: string }> = {
  SUBMITTED: { bg: "#6B7689", label: "Submitted" },
  IN_REVIEW: { bg: "#B8893B", label: "Officer reviewing" },
  CLEARED: { bg: "#2F5D44", label: "Cleared" },
  FLAGGED: { bg: "#B5532A", label: "Flagged" },
  REJECTED: { bg: "#7A1F1F", label: "Rejected" },
};

const nav: NavItem[] = [
  { href: "/citizen", label: "Search & requests", icon: <Search className="h-4 w-4" /> },
];

export default function CitizenHome() {
  return (
    <RoleShell role="CITIZEN" nav={nav}>
      <CitizenInner />
    </RoleShell>
  );
}

function CitizenInner() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api<MyRequest[]>("/api/requests/mine").then(setRequests).catch(() => {});
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) { setHits([]); setSearched(false); return; }
    debounce.current = setTimeout(() => {
      api<SearchHit[]>(`/api/public/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => { setHits(r); setSearched(true); })
        .catch(() => {});
    }, 250);
  }, [q]);

  return (
    <div className="space-y-12">
      {/* ---------- HERO SEARCH ---------- */}
      <section className="relative overflow-hidden rounded-xl border border-ink/10 bg-gradient-to-br from-forest/10 via-parchment to-parchment p-8 shadow-raised md:p-12">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-forest/10 blur-2xl" />
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-flex items-center gap-2 rounded-full bg-forest/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-forest">
            <ShieldCheck className="h-3.5 w-3.5" /> Before you pay, verify
          </span>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-ink md:text-5xl">
            Is this property safe to buy?
          </h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Search by survey number, khata, or locality. We&apos;ll give you a plain-language
            verdict — and if anything looks risky, you can ask a land-records officer to verify it for you.
          </p>

          <div className="relative mt-6 max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. Koramangala, SY-89, or KH-147"
              className="w-full rounded-full border border-ink/20 bg-parchment py-3.5 pl-12 pr-4 text-ink shadow-ledger outline-none transition focus:border-forest"
            />
          </div>
        </motion.div>

        {/* results */}
        <AnimatePresence>
          {hits.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mt-4 max-w-xl space-y-2"
            >
              {hits.map((h) => (
                <button
                  key={h.id}
                  onClick={() => router.push(`/citizen/property/${h.id}`)}
                  className="group flex w-full items-center justify-between rounded-lg border border-ink/10 bg-parchment px-4 py-3 text-left shadow-ledger transition hover:-translate-y-0.5 hover:border-forest/40"
                >
                  <span>
                    <span className="font-serif text-ink">{h.surveyNo}</span>
                    <span className="ml-2 inline-flex items-center gap-1 text-sm text-ink-soft">
                      <MapPin className="h-3.5 w-3.5" /> {h.village}, {h.taluk}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-ink-faint transition group-hover:translate-x-1 group-hover:text-forest" />
                </button>
              ))}
            </motion.div>
          )}
          {searched && hits.length === 0 && (
            <p className="mt-4 max-w-xl rounded-lg border border-ink/10 bg-parchment px-4 py-3 text-sm text-ink-soft">
              No property matched “{q}”. Try a locality like <em>Koramangala</em> or a survey number like <em>SY-56</em>.
            </p>
          )}
        </AnimatePresence>
      </section>

      {/* ---------- MY REQUESTS ---------- */}
      <section>
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-forest" />
          <h2 className="font-serif text-2xl text-ink">My verification requests</h2>
        </div>
        <p className="mt-1 text-sm text-ink-soft">Requests you&apos;ve sent to land-records officers, and what came back.</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {requests.map((r, i) => {
            const st = reqStatusStyle[r.status] ?? reqStatusStyle.SUBMITTED;
            return (
              <motion.button
                key={r.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                onClick={() => router.push(`/citizen/property/${r.property.id}`)}
                className="rounded-lg border border-ink/10 bg-parchment p-5 text-left shadow-raised transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-serif text-lg text-ink">{r.property.surveyNo}</span>
                    <div className="text-sm text-ink-soft">{r.property.village}, {r.property.taluk}</div>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: st.bg }}>
                    {st.label}
                  </span>
                </div>
                <div className="mt-2 text-xs uppercase tracking-wider text-ink-faint">Purpose · {r.purpose.toLowerCase()}</div>
                {r.officerNote && (
                  <p className="mt-3 rounded-sm bg-ink/5 p-3 text-sm text-ink-soft">
                    <span className="font-medium text-ink">Officer {r.officer?.name ?? ""}: </span>
                    {r.officerNote}
                  </p>
                )}
                {!r.officerNote && r.status === "SUBMITTED" && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-faint">
                    <Clock className="h-4 w-4" /> Waiting for an officer to pick this up.
                  </p>
                )}
              </motion.button>
            );
          })}
          {requests.length === 0 && (
            <p className="rounded-lg border border-dashed border-ink/20 p-6 text-sm text-ink-faint">
              You haven&apos;t requested any verifications yet. Search a property above and open its trust report to request one.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
