"use client";

// MY ACCOUNT — self-service profile for any logged-in role. Shows who you are,
// your role/jurisdiction (read-only — only an admin can change those), a small
// activity summary, and lets you update your display name or change your
// password. Role-agnostic, so it doesn't use the role-locked RoleShell.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Landmark, ArrowLeft, User, KeyRound, ShieldCheck, Check } from "lucide-react";
import { api, getUser, updateSessionUser, roleHome, type SessionUser } from "@/lib/api";

interface Me {
  id: string; name: string; email: string; role: SessionUser["role"];
  jurisdiction: string | null; createdAt: string;
  _count: { requestsMade: number; requestsHandled: number; verifiedFindings: number };
}

const roleAccent: Record<string, string> = {
  CITIZEN: "#2F5D44", OFFICER: "#B5532A", AUTHORITY: "#1B2A41", ADMIN: "#7A1F1F",
};

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!getUser()) { router.replace("/login"); return; }
    api<Me>("/api/auth/me").then(setMe).catch(() => router.replace("/login"));
  }, [router]);

  if (!me) {
    return <main className="flex min-h-screen items-center justify-center bg-survey text-ink-soft">Loading…</main>;
  }

  const accent = roleAccent[me.role] ?? "#1B2A41";

  return (
    <main className="min-h-screen bg-survey">
      <header className="border-b border-ink/10 bg-parchment">
        <span className="block h-0.5 w-full" style={{ background: accent }} />
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href={roleHome(me.role)} className="inline-flex items-center gap-2 text-ink-soft hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <div className="flex items-center gap-2 text-ink">
            <Landmark className="h-5 w-5" />
            <span className="text-sm uppercase tracking-[0.2em]">VeriBhoomi</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        {/* identity card */}
        <motion.section
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-ink/10 bg-parchment p-6 shadow-raised"
        >
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-full text-xl font-semibold text-parchment" style={{ background: accent }}>
              {me.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div>
              <h1 className="font-serif text-2xl text-ink">{me.name}</h1>
              <p className="text-sm text-ink-soft">{me.email}</p>
            </div>
            <span className="ml-auto rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: accent }}>
              {me.role}
            </span>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-ink-faint">Jurisdiction</dt>
              <dd className="mt-0.5 text-ink">{me.jurisdiction ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Member since</dt>
              <dd className="mt-0.5 text-ink">{new Date(me.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short" })}</dd>
            </div>
            {me.role === "CITIZEN" ? (
              <div>
                <dt className="text-ink-faint">Requests made</dt>
                <dd className="mt-0.5 text-ink">{me._count.requestsMade}</dd>
              </div>
            ) : (
              <>
                <div>
                  <dt className="text-ink-faint">Cases handled</dt>
                  <dd className="mt-0.5 text-ink">{me._count.requestsHandled}</dd>
                </div>
                <div>
                  <dt className="text-ink-faint">Findings verified</dt>
                  <dd className="mt-0.5 text-ink">{me._count.verifiedFindings}</dd>
                </div>
              </>
            )}
          </dl>
        </motion.section>

        <NameCard me={me} onSaved={(name) => setMe({ ...me, name })} />
        <PasswordCard />

        <p className="flex items-start gap-2 rounded-sm bg-ink/[0.03] p-3 text-xs text-ink-faint">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
          Your role and jurisdiction are managed by an administrator and can&apos;t be changed here.
          Every account change is recorded in the audit log.
        </p>
      </div>
    </main>
  );
}

function NameCard({ me, onSaved }: { me: Me; onSaved: (name: string) => void }) {
  const [name, setName] = useState(me.name);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError(""); setDone(false);
    if (name.trim().length < 1) { setError("Name can't be empty."); return; }
    setSaving(true);
    try {
      const updated = await api<{ name: string }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      updateSessionUser({ name: updated.name });
      onSaved(updated.name);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      setError("Could not update your name.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = name.trim() !== me.name;

  return (
    <section className="rounded-xl border border-ink/10 bg-parchment p-6 shadow-raised">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-ink-faint" />
        <h2 className="text-sm uppercase tracking-[0.18em] text-ink-faint">Display name</h2>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-[14rem] flex-1 rounded-sm border border-ink/20 bg-white/60 px-3 py-2 text-sm outline-none focus:border-terracotta"
        />
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-sm bg-ink px-4 py-2 text-sm font-medium text-parchment transition hover:bg-ink-soft disabled:opacity-50"
        >
          {done ? <><Check className="h-4 w-4" /> Saved</> : saving ? "Saving…" : "Save name"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-seal">{error}</p>}
    </section>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError(""); setDone(false);
    if (newPassword.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (newPassword !== confirm) { setError("New passwords don't match."); return; }
    setSaving(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setDone(true);
      setCurrent(""); setNew(""); setConfirm("");
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg.includes("incorrect") ? "Your current password is incorrect." : "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  const cls = "mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 text-sm outline-none focus:border-terracotta";

  return (
    <section className="rounded-xl border border-ink/10 bg-parchment p-6 shadow-raised">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-ink-faint" />
        <h2 className="text-sm uppercase tracking-[0.18em] text-ink-faint">Change password</h2>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm text-ink-soft">Current password</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} className={cls} />
        </div>
        <div>
          <label className="text-sm text-ink-soft">New password</label>
          <input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} placeholder="min 8 characters" className={cls} />
        </div>
        <div>
          <label className="text-sm text-ink-soft">Confirm new password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={cls} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-seal">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving || !currentPassword || !newPassword}
          className="inline-flex items-center gap-2 rounded-sm bg-ink px-4 py-2 text-sm font-medium text-parchment transition hover:bg-ink-soft disabled:opacity-50"
        >
          {done ? <><Check className="h-4 w-4" /> Updated</> : saving ? "Updating…" : "Update password"}
        </button>
      </div>
    </section>
  );
}
