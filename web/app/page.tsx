"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useSpring, useInView } from "framer-motion";
import {
  ScrollText, GitBranch, ShieldCheck, ArrowRight, Landmark,
  Layers, Users, Map as MapIcon, Search, AlertOctagon, Coins,
  FileWarning, Gavel, Repeat, Eye, CheckCircle2, BadgeCheck,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

// ---------- small building blocks ----------

// Count up to a target when scrolled into view. Pure client-side, no data fetch
// (the landing page is public; real numbers live behind auth).
function CountUp({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    let start = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return <span ref={ref}>{val.toLocaleString("en-IN")}{suffix}</span>;
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <motion.div
      variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} custom={0}
    >
      <h2 className="text-sm uppercase tracking-[0.2em] text-ink-faint">{kicker}</h2>
      <p className="mt-3 max-w-3xl font-serif text-3xl leading-snug text-ink md:text-4xl">{title}</p>
    </motion.div>
  );
}

// ---------- content data ----------

const STATS = [
  { icon: Layers, to: 24, suffix: "", label: "Record types cross-checked", color: "#1B2A41" },
  { icon: AlertOctagon, to: 9, suffix: "", label: "Fraud signals detected", color: "#B5532A" },
  { icon: GitBranch, to: 100, suffix: "%", label: "Findings traced to a record", color: "#2F5D44" },
  { icon: ScrollText, to: 0, suffix: "", label: "Decisions left unlogged", color: "#7A1F1F" },
];

const SIGNALS = [
  { icon: Repeat, title: "Double selling", body: "Two owners with overlapping title dates on the same plot — the classic fraud, invisible in any single deed." },
  { icon: FileWarning, title: "Area mismatch", body: "The sale deed says 2,400 sq ft; the mutation says 1,500. Documents that disagree are the first red flag." },
  { icon: Coins, title: "Uncleared lien", body: "A loan was taken against the property and never marked cleared — the bank still has a claim you can't see." },
  { icon: Gavel, title: "Pending litigation", body: "An open court case on the plot, quietly omitted from what the seller shows you." },
  { icon: Users, title: "Broken inheritance", body: "A chain of succession that loops, skips, or contradicts the recorded owner." },
  { icon: BadgeCheck, title: "Stale approvals", body: "Government approvals that expired or were never granted at the right bureaucratic level." },
];

const ROLES = [
  {
    key: "CITIZEN", label: "Citizen", icon: Search, color: "#2F5D44",
    headline: "“Is this property safe to buy?”",
    body: "Search by survey number or locality and get a plain-language verdict — no jargon, no party names. If something looks risky, ask a land-records officer to verify it for you, and track the request to its outcome.",
    points: ["Plain-language trust report", "Request an official verification", "Track status end-to-end"],
  },
  {
    key: "OFFICER", label: "Officer", icon: ShieldCheck, color: "#B5532A",
    headline: "A real caseload, not a brochure",
    body: "Verification requests land in your queue, scoped to your district. Claim a case, open the forensic relationship web, attach documents, and resolve with a note that goes back to the citizen — every step recorded.",
    points: ["District-scoped queue", "Forensic relationship graph", "Attach & supersede documents"],
  },
  {
    key: "AUTHORITY", label: "Authority", icon: MapIcon, color: "#1B2A41",
    headline: "The regional command view",
    body: "An interactive map of every property, charts that break down status, risk and the verification funnel, and a live audit timeline of who did what across the region.",
    points: ["Property map & risk donut", "Verification funnel", "Append-only audit timeline"],
  },
  {
    key: "ADMIN", label: "Admin", icon: Users, color: "#7A1F1F",
    headline: "Who can use the system",
    body: "Provision staff, assign roles, and scope officers to a district — and nothing more. Admins manage access, never property data or findings. Separation of duty, enforced.",
    points: ["Provision & role-assign users", "Scope officers to districts", "No access to record data"],
  },
];

// ---------- page ----------

export default function Landing() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  const [activeRole, setActiveRole] = useState(0);
  // gently auto-advance the role showcase; pauses are implicit (resets on click)
  useEffect(() => {
    const t = setInterval(() => setActiveRole((r) => (r + 1) % ROLES.length), 5000);
    return () => clearInterval(t);
  }, [activeRole]);

  const nav = [
    { href: "#problem", label: "The problem" },
    { href: "#how", label: "How it works" },
    { href: "#signals", label: "What we catch" },
    { href: "#roles", label: "For every role" },
  ];

  return (
    <main className="min-h-screen scroll-smooth bg-survey">
      {/* scroll progress bar */}
      <motion.div
        className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-terracotta"
        style={{ scaleX: progress }}
      />

      {/* ---------- STICKY HEADER ---------- */}
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-parchment/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2 text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-sm bg-ink">
              <Landmark className="h-4 w-4 text-parchment" />
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.18em]">VeriBhoomi</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <a key={n.href} href={n.href} className="rounded-sm px-3 py-1.5 text-sm text-ink-soft transition hover:bg-ink/5 hover:text-ink">
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-sm px-3 py-1.5 text-sm text-ink-soft transition hover:text-ink">
              Sign in
            </Link>
            <Link href="/register" className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3.5 py-1.5 text-sm text-parchment transition hover:bg-ink-soft">
              Create account <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-parchment/30 via-parchment/10 to-transparent" />
        {/* floating seal flourish */}
        <div className="pointer-events-none absolute -right-16 top-24 hidden animate-float opacity-[0.07] lg:block">
          <Landmark className="h-72 w-72 text-ink" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-24">
          <motion.div initial="hidden" animate="show" className="flex flex-col items-start">
            <motion.span custom={0} variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-parchment px-3 py-1 text-xs uppercase tracking-[0.2em] text-ink-faint shadow-ledger">
              <span className="h-2 w-2 rounded-full bg-forest" /> Transparent land records
            </motion.span>

            <motion.h1 custom={1} variants={fadeUp} className="max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
              The truth about a property,<br />
              <span className="text-terracotta">before it becomes a dispute.</span>
            </motion.h1>

            <motion.p custom={2} variants={fadeUp} className="mt-6 max-w-2xl text-lg text-ink-soft">
              Most land fraud doesn&apos;t hide in one document — it hides in the
              <em> contradictions between them</em>. VeriBhoomi maps every owner, tax,
              lien, inheritance and dispute attached to a property, then surfaces the
              risks no single paper reveals.
            </motion.p>

            <motion.div custom={3} variants={fadeUp} className="mt-10 flex flex-wrap gap-4">
              <Link href="/register" className="group inline-flex items-center gap-2 rounded-sm bg-ink px-6 py-3 text-parchment shadow-ledger transition hover:bg-ink-soft">
                Create an account
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-sm border border-ink/25 px-6 py-3 text-ink transition hover:bg-ink/5">
                Sign in
              </Link>
            </motion.div>
            <motion.p custom={4} variants={fadeUp} className="mt-4 text-xs text-ink-faint">
              Four roles, four different experiences — citizen, officer, authority, admin.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ---------- STAT STRIP ---------- */}
      <section className="border-y border-ink/10 bg-parchment-dark/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 py-2 md:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }}
              className="flex items-center gap-4 px-4 py-6"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-sm" style={{ background: `${s.color}14`, color: s.color }}>
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <div className="font-serif text-3xl font-semibold text-ink">
                  <CountUp to={s.to} suffix={s.suffix} />
                </div>
                <div className="text-xs leading-tight text-ink-faint">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- THE PROBLEM ---------- */}
      <section id="problem" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <SectionHeading kicker="The problem" title="A clean-looking deed can hide a ruinous claim." />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <motion.p
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} custom={1}
            className="font-serif text-xl leading-relaxed text-ink-soft"
          >
            A buyer sees a clean sale deed. They don&apos;t see the mutation record with a
            different plot area, the tax receipt in someone else&apos;s name, the loan never
            cleared, or the case pending in court.
          </motion.p>
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} custom={2}
            className="rounded-lg border-l-4 border-seal bg-seal/5 p-6"
          >
            <p className="font-serif text-lg text-ink">
              “By the time these surface, the money is gone.”
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              Land disputes can take years in court. The information that would have
              prevented them usually existed all along — just scattered across documents
              that were never read together.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how" className="scroll-mt-20 bg-parchment-dark/50">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHeading kicker="How it works" title="Read everything. Map the web. Flag the risk." />
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { icon: ScrollText, title: "Read every document", body: "Sale deeds, mutations, tax receipts, encumbrance certificates — extracted into structured records, with confidence flagged for human review." },
              { icon: GitBranch, title: "Map the relationships", body: "Owners, heirs, lenders, disputes and bureaucracy levels become one connected web — the place where fraud actually lives." },
              { icon: ShieldCheck, title: "Flag risk, keep a human in charge", body: "A deterministic engine scores the property and explains every red flag. An officer verifies or overrides — every decision recorded." },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                custom={i} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}
                className="group relative rounded-lg border border-ink/10 bg-parchment p-6 shadow-ledger transition hover:-translate-y-1 hover:shadow-raised"
              >
                <span className="absolute right-5 top-5 font-serif text-4xl text-ink/10 transition group-hover:text-terracotta/20">
                  {i + 1}
                </span>
                <step.icon className="h-7 w-7 text-terracotta" />
                <h3 className="mt-4 text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- SIGNALS WE CATCH ---------- */}
      <section id="signals" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <SectionHeading kicker="What we catch" title="The contradictions a single document will never show you." />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SIGNALS.map((sig, i) => (
            <motion.div
              key={sig.title}
              custom={i % 3} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
              className="group rounded-lg border border-ink/10 bg-parchment p-5 shadow-ledger transition hover:-translate-y-1 hover:border-terracotta/40 hover:shadow-glow-terracotta"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-sm bg-terracotta/10 text-terracotta transition group-hover:bg-terracotta group-hover:text-parchment">
                  <sig.icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg">{sig.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{sig.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- ROLES: LEFT SIDEBAR + CONTENT PANEL ---------- */}
      <section id="roles" className="scroll-mt-20 bg-parchment-dark/50">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHeading kicker="For every role" title="One system, four genuinely different experiences." />

          <div className="mt-12 grid gap-8 md:grid-cols-[260px_1fr]">
            {/* sidebar */}
            <div className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
              {ROLES.map((r, i) => {
                const active = i === activeRole;
                return (
                  <button
                    key={r.key}
                    onClick={() => setActiveRole(i)}
                    className="group relative flex shrink-0 items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition md:shrink"
                    style={{
                      borderColor: active ? r.color : "rgba(27,42,65,0.12)",
                      background: active ? `${r.color}10` : "transparent",
                    }}
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-sm transition" style={{ background: active ? r.color : "rgba(27,42,65,0.06)", color: active ? "#F4EEE2" : r.color }}>
                      <r.icon className="h-4 w-4" />
                    </span>
                    <span className="font-medium" style={{ color: active ? r.color : "#34435A" }}>{r.label}</span>
                    {active && (
                      <motion.span layoutId="role-rail" className="absolute inset-y-2 left-0 w-0.5 rounded-full" style={{ background: r.color }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* content panel */}
            <motion.div
              key={activeRole}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-ink/10 bg-parchment p-8 shadow-raised"
            >
              {(() => {
                const r = ROLES[activeRole];
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-sm" style={{ background: r.color, color: "#F4EEE2" }}>
                        <r.icon className="h-6 w-6" />
                      </span>
                      <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-parchment" style={{ background: r.color }}>
                        {r.label}
                      </span>
                    </div>
                    <h3 className="mt-5 font-serif text-2xl text-ink">{r.headline}</h3>
                    <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{r.body}</p>
                    <ul className="mt-6 grid gap-2 sm:grid-cols-3">
                      {r.points.map((p) => (
                        <li key={p} className="flex items-start gap-2 rounded-sm bg-ink/[0.03] px-3 py-2 text-sm text-ink">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: r.color }} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </>
                );
              })()}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---------- CTA BAND ---------- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-parchment/70 via-parchment/30 to-parchment/70" />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={0}>
            <Eye className="mx-auto h-9 w-9 text-terracotta" />
            <h2 className="mt-5 font-serif text-3xl text-ink md:text-4xl">See a property the way a forensic officer would.</h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-soft">
              Create a free citizen account and run a trust report in under a minute — on sample land records.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/register" className="group inline-flex items-center gap-2 rounded-sm bg-terracotta px-6 py-3 text-parchment shadow-glow-terracotta transition hover:bg-terracotta-soft">
                Get started <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-sm border border-ink/25 px-6 py-3 text-ink transition hover:bg-ink/5">
                I already have an account
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-ink/10 bg-parchment-dark/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2 text-ink">
                <span className="grid h-8 w-8 place-items-center rounded-sm bg-ink">
                  <Landmark className="h-4 w-4 text-parchment" />
                </span>
                <span className="text-sm font-semibold uppercase tracking-[0.18em]">VeriBhoomi</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
                Transparent land records and deterministic fraud detection. Built to surface
                the contradictions between documents — where fraud actually lives.
              </p>
            </div>

            <FooterCol title="Product" links={[
              { label: "The problem", href: "#problem" },
              { label: "How it works", href: "#how" },
              { label: "What we catch", href: "#signals" },
              { label: "For every role", href: "#roles" },
            ]} />
            <FooterCol title="Get started" links={[
              { label: "Create account", href: "/register" },
              { label: "Sign in", href: "/login" },
            ]} />
            <FooterCol title="Roles" links={[
              { label: "Citizen", href: "/login" },
              { label: "Officer", href: "/login" },
              { label: "Authority", href: "/login" },
              { label: "Admin", href: "/login" },
            ]} />
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-ink/10 pt-6 text-sm text-ink-faint md:flex-row md:items-center">
            <span>© {2026} VeriBhoomi — a demonstration system on sample data.</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Every action audited · least-privilege by design
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-[0.18em] text-ink-faint">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-ink-soft transition hover:text-ink">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
