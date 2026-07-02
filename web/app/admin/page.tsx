"use client";

// ADMIN — user & role management only (separation of duty). The admin decides
// WHO can use the system and at what role/jurisdiction, but never touches
// property data or verifies findings. Provision staff, change roles, scope
// officers to a district.

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserPlus, ShieldCheck, Pencil, X } from "lucide-react";
import { RoleShell, type NavItem } from "@/components/shell/RoleShell";
import { StatTile } from "@/components/viz/charts";
import { api } from "@/lib/api";

interface ManagedUser {
  id: string; name: string; email: string; role: string; jurisdiction: string | null; createdAt: string;
  _count: { verifiedFindings: number; requestsHandled: number; requestsMade: number };
}

const nav: NavItem[] = [
  { href: "/admin", label: "Users & roles", icon: <Users className="h-4 w-4" /> },
];

const roleColor: Record<string, string> = {
  CITIZEN: "#2F5D44", OFFICER: "#B5532A", AUTHORITY: "#1B2A41", ADMIN: "#7A1F1F",
};
const roles = ["CITIZEN", "OFFICER", "AUTHORITY", "ADMIN"];

export default function AdminHome() {
  return (
    <RoleShell role="ADMIN" nav={nav}>
      <AdminInner />
    </RoleShell>
  );
}

function AdminInner() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<ManagedUser[]>("/api/admin/users").then(setUsers).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const counts = roles.reduce((acc, r) => { acc[r] = users.filter((u) => u.role === r).length; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-ink">Users &amp; roles</h1>
          <p className="mt-1 text-ink-soft">Provision staff and assign roles. Admins manage access only — never property data.</p>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-sm bg-seal px-4 py-2.5 text-sm font-medium text-white shadow-ledger transition hover:opacity-90">
          <UserPlus className="h-4 w-4" /> Add user
        </button>
      </div>

      {/* role counts */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {roles.map((r, i) => (
          <StatTile key={r} label={`${r.charAt(0)}${r.slice(1).toLowerCase()}s`} value={counts[r] ?? 0} accent={roleColor[r]} icon={<ShieldCheck className="h-5 w-5" />} delay={i * 0.05} />
        ))}
      </section>

      {/* user table */}
      <section className="overflow-hidden rounded-lg border border-ink/10 bg-parchment shadow-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 bg-parchment-dark/40 text-left text-xs uppercase tracking-wider text-ink-faint">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Jurisdiction</th>
              <th className="px-5 py-3">Activity</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <motion.tr
                key={u.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="border-b border-ink/5 last:border-0 hover:bg-ink/[0.02]"
              >
                <td className="px-5 py-3 font-medium text-ink">{u.name}</td>
                <td className="px-5 py-3 text-ink-soft">{u.email}</td>
                <td className="px-5 py-3">
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: roleColor[u.role] }}>{u.role}</span>
                </td>
                <td className="px-5 py-3 text-ink-soft">{u.jurisdiction ?? <span className="text-ink-faint">—</span>}</td>
                <td className="px-5 py-3 text-ink-faint">
                  {u.role === "CITIZEN"
                    ? `${u._count.requestsMade} requests made`
                    : `${u._count.requestsHandled} cases · ${u._count.verifiedFindings} verified`}
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => setEditing(u)} className="inline-flex items-center gap-1 rounded-sm border border-ink/20 px-2.5 py-1 text-xs text-ink transition hover:bg-ink hover:text-parchment">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </section>

      <AnimatePresence>
        {editing && <EditModal user={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
        {creating && <CreateModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-ink-soft">{label}</label>
      {children}
    </div>
  );
}

function RolePicker({ value, onChange }: { value: string; onChange: (r: string) => void }) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-2">
      {roles.map((r) => (
        <button
          key={r} type="button" onClick={() => onChange(r)}
          className="rounded-sm border px-3 py-2 text-sm transition"
          style={{
            borderColor: value === r ? roleColor[r] : "rgba(27,42,65,0.2)",
            background: value === r ? `${roleColor[r]}12` : "transparent",
            color: value === r ? roleColor[r] : "#34435A",
          }}
        >{r}</button>
      ))}
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 text-sm outline-none focus:border-seal";
const needsJuris = (r: string) => r === "OFFICER" || r === "AUTHORITY";

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-ink/10 bg-parchment p-6 shadow-raised">
        {children}
      </motion.div>
    </motion.div>
  );
}

function EditModal({ user, onClose, onDone }: { user: ManagedUser; onClose: () => void; onDone: () => void }) {
  const [role, setRole] = useState(user.role);
  const [jurisdiction, setJurisdiction] = useState(user.jurisdiction ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ role, jurisdiction: needsJuris(role) ? jurisdiction : null }) });
      onDone();
    } finally { setSaving(false); }
  }

  return (
    <Shell onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-ink">Edit {user.name}</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-ink-faint hover:text-ink" /></button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
      <div className="mt-4 space-y-4">
        <Field label="Role"><RolePicker value={role} onChange={setRole} /></Field>
        {needsJuris(role) && (
          <Field label="Jurisdiction (district)">
            <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. Bengaluru Urban" className={inputCls} />
          </Field>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button onClick={onClose} className="rounded-sm border border-ink/20 px-4 py-2 text-sm text-ink hover:bg-ink/5">Cancel</button>
        <button onClick={save} disabled={saving} className="rounded-sm bg-seal px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
      </div>
    </Shell>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("OFFICER");
  const [jurisdiction, setJurisdiction] = useState("Bengaluru Urban");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    if (!name || !email || password.length < 8) { setError("Name, email, and a password of 8+ characters are required."); return; }
    setSaving(true);
    try {
      await api("/api/admin/users", { method: "POST", body: JSON.stringify({ name, email, password, role, jurisdiction: needsJuris(role) ? jurisdiction : null }) });
      onDone();
    } catch {
      setError("Could not create user — the email may already be registered.");
    } finally { setSaving(false); }
  }

  return (
    <Shell onClose={onClose}>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-ink">Add user</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-ink-faint hover:text-ink" /></button>
      </div>
      <div className="mt-4 space-y-4">
        <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
        <Field label="Temporary password"><input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" className={inputCls} /></Field>
        <Field label="Role"><RolePicker value={role} onChange={setRole} /></Field>
        {needsJuris(role) && (
          <Field label="Jurisdiction (district)"><input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} className={inputCls} /></Field>
        )}
        {error && <p className="text-sm text-seal">{error}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button onClick={onClose} className="rounded-sm border border-ink/20 px-4 py-2 text-sm text-ink hover:bg-ink/5">Cancel</button>
        <button onClick={save} disabled={saving} className="rounded-sm bg-seal px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">{saving ? "Creating…" : "Create user"}</button>
      </div>
    </Shell>
  );
}
