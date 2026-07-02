"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Landmark } from "lucide-react";
import { api, setSession, roleHome, type SessionUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("citizen@demo.in");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<{ token: string; user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(res.token, res.user);
      router.push(roleHome(res.user.role));
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-survey px-6">
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
        <h1 className="text-2xl">Sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">Access your dashboard.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-ink-soft">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 outline-none focus:border-terracotta"
            />
          </div>
          <div>
            <label className="text-sm text-ink-soft">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 outline-none focus:border-terracotta"
            />
          </div>
          {error && <p className="text-sm text-seal">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-sm bg-ink py-2.5 text-parchment transition hover:bg-ink-soft disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 rounded-sm bg-parchment-dark/60 p-3 text-xs text-ink-soft">
          <p className="font-medium">Try a role (password auto-filled)</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { email: "citizen@demo.in", label: "Citizen", color: "#2F5D44" },
              { email: "officer@demo.in", label: "Officer", color: "#B5532A" },
              { email: "authority@demo.in", label: "Authority", color: "#1B2A41" },
              { email: "admin@demo.in", label: "Admin", color: "#7A1F1F" },
            ].map((r) => (
              <button
                key={r.email}
                type="button"
                onClick={() => { setEmail(r.email); setPassword("password123"); }}
                className="flex items-center gap-2 rounded-sm border border-ink/15 bg-parchment px-2.5 py-1.5 text-left transition hover:border-ink/30"
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                <span className="text-ink">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-ink-soft">
          New here?{" "}
          <Link href="/register" className="font-medium text-ink hover:underline">Create an account</Link>
        </p>
        <p className="mt-2 text-center text-sm text-ink-faint">
          <Link href="/" className="hover:text-ink">← Back home</Link>
        </p>
      </motion.div>
    </main>
  );
}
