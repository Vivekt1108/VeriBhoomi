"use client";

// PUBLIC REGISTRATION — citizens self-enroll here. Mirrors the login page's
// look. Only ever creates CITIZEN accounts: staff (officer/authority/admin) are
// provisioned by an admin, never self-declared — a deliberate security rule for
// a land-records system. The backend (POST /api/auth/register) enforces that;
// this page just collects name/email/password and lands them on their portal.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Landmark, ShieldCheck } from "lucide-react";
import { api, setSession, roleHome, type SessionUser } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 1) { setError("Please enter your name."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setLoading(true);
    try {
      const res = await api<{ token: string; user: SessionUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      setSession(res.token, res.user);
      router.push(roleHome(res.user.role));
    } catch (err) {
      // backend returns 409 with "Email already registered", or a 400 validation shape
      const msg = (err as Error).message;
      setError(msg.includes("already") ? "That email is already registered. Try signing in." : "Could not create your account. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-survey px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-sm border border-ink/10 bg-parchment p-8 shadow-ledger"
      >
        <div className="mb-6 flex items-center gap-2 text-ink-faint">
          <Landmark className="h-5 w-5" />
          <span className="text-sm uppercase tracking-[0.2em]">VeriBhoomi</span>
        </div>
        <h1 className="text-2xl">Create your account</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Verify properties before you buy, and track your requests to land-records officers.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-ink-soft">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vivek Sharma"
              className="mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 outline-none focus:border-forest"
            />
          </div>
          <div>
            <label className="text-sm text-ink-soft">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 outline-none focus:border-forest"
            />
          </div>
          <div>
            <label className="text-sm text-ink-soft">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="at least 8 characters"
              className="mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 outline-none focus:border-forest"
            />
          </div>
          <div>
            <label className="text-sm text-ink-soft">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 outline-none focus:border-forest"
            />
          </div>
          {error && <p className="text-sm text-seal">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-forest py-2.5 text-parchment transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="mt-5 flex items-start gap-2 rounded-sm bg-forest/5 p-3 text-xs text-ink-soft">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
          <span>
            Public sign-up creates a <strong className="text-ink">citizen</strong> account. Officers and
            authorities are provisioned by an administrator.
          </span>
        </div>

        <p className="mt-4 text-center text-sm text-ink-faint">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-ink hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </main>
  );
}
