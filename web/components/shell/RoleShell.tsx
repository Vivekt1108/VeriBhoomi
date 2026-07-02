"use client";

// Shared application shell for the logged-in role apps.
// Guards the route (kicks you to /login if not authed, or to your own home if
// your role doesn't match), and renders a role-tinted top bar + optional nav.
// Each role gets its own accent so the four apps feel distinct at a glance.

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Landmark, LogOut, UserCircle } from "lucide-react";
import { getUser, clearSession, roleHome, type SessionUser } from "@/lib/api";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const roleAccent: Record<string, { accent: string; tag: string }> = {
  CITIZEN: { accent: "#2F5D44", tag: "Citizen portal" },
  OFFICER: { accent: "#B5532A", tag: "Officer console" },
  AUTHORITY: { accent: "#1B2A41", tag: "Authority oversight" },
  ADMIN: { accent: "#7A1F1F", tag: "System administration" },
};

export function RoleShell({
  role,
  nav = [],
  children,
}: {
  role: SessionUser["role"];
  nav?: NavItem[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace("/login"); return; }
    if (u.role !== role) { router.replace(roleHome(u.role)); return; }
    setUser(u);
    setReady(true);
  }, [role, router]);

  if (!ready || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-survey text-ink-soft">Loading…</main>;
  }

  const { accent, tag } = roleAccent[role];

  function logout() {
    clearSession();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-survey">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-parchment/85 backdrop-blur">
        <span className="block h-0.5 w-full" style={{ background: accent }} />
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href={roleHome(role)} className="flex items-center gap-2 text-ink">
              <span className="grid h-8 w-8 place-items-center rounded-sm" style={{ background: accent }}>
                <Landmark className="h-4 w-4 text-parchment" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-sm font-semibold uppercase tracking-[0.18em]">VeriBhoomi</span>
                <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: accent }}>{tag}</span>
              </span>
            </Link>

            {nav.length > 0 && (
              <nav className="hidden items-center gap-1 md:flex">
                {nav.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="relative inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition hover:bg-ink/5"
                      style={{ color: active ? accent : "#34435A" }}
                    >
                      {item.icon}
                      {item.label}
                      {active && (
                        <motion.span
                          layoutId="nav-underline"
                          className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full"
                          style={{ background: accent }}
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Link href="/profile" className="hidden items-center gap-1.5 text-ink-soft transition hover:text-ink sm:inline-flex" title="My account">
              <UserCircle className="h-4 w-4" />
              {user.name}
              {user.jurisdiction ? <span className="text-ink-faint"> · {user.jurisdiction}</span> : null}
            </Link>
            <button onClick={logout} className="inline-flex items-center gap-1 text-ink-faint transition hover:text-ink">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
