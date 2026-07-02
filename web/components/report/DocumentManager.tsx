"use client";

// DocumentManager — the officer/authority document panel on the forensic page.
//
// Encodes the full vision:
//   - Officers attach OFFICIAL documents (backend enforces jurisdiction).
//   - Each doc has a recognised type + confirmed key fields (so the engine can
//     cross-check them).
//   - If the new doc CONTRADICTS the record, the upload is held (HTTP 409) and
//     the officer is warned: they must type a reason to proceed (logged).
//   - Documents are append-only: a wrong one is SUPERSEDED, never deleted, and
//     stays visible in the history.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, X, Eye, EyeOff, AlertTriangle, History, ShieldCheck, Upload, RefreshCw,
} from "lucide-react";
import { api, apiUpload, ApiError } from "@/lib/api";
import { DocViewer } from "./DocViewer";

export interface ManagedDoc {
  id: string;
  type: string;
  extractedFields: Record<string, unknown>;
  ocrConfidence: number;
  status: string; // OFFICIAL | PENDING | SUPERSEDED
  fileName?: string | null;
  storageKey?: string | null;
  overrideReason?: string | null;
  supersededById?: string | null;
  uploadedBy?: { name: string; role: string } | null;
  createdAt?: string;
}

interface Conflict { field: string; existingValue: string; newValue: string; againstType: string; }

const DOC_TYPES = [
  { v: "SALE_DEED", l: "Sale Deed" },
  { v: "MUTATION", l: "Mutation / Khata" },
  { v: "TAX_RECEIPT", l: "Tax Receipt" },
  { v: "ENCUMBRANCE_CERT", l: "Encumbrance Certificate" },
  { v: "GOVT_APPROVAL", l: "Govt Approval" },
];
const labelFor = (t: string) => DOC_TYPES.find((d) => d.v === t)?.l ?? t.replace(/_/g, " ");

const statusStyle: Record<string, { label: string; color: string; bg: string }> = {
  OFFICIAL:   { label: "Official",   color: "#2F5D44", bg: "rgba(47,93,68,0.10)" },
  PENDING:    { label: "Pending",    color: "#B8893B", bg: "rgba(184,137,59,0.12)" },
  SUPERSEDED: { label: "Superseded", color: "#6B7689", bg: "rgba(107,118,137,0.12)" },
};

export function DocumentManager({
  propertyId, documents, canEdit, onChange,
}: {
  propertyId: string;
  documents: ManagedDoc[];
  canEdit: boolean;
  onChange: () => void;
}) {
  // null = closed; {} = adding fresh; {replaces} = uploading a replacement that
  // will supersede an existing doc.
  const [modal, setModal] = useState<{ replaces?: ManagedDoc } | null>(null);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const active = documents.filter((d) => d.status !== "SUPERSEDED");
  const superseded = documents.filter((d) => d.status === "SUPERSEDED");

  return (
    <div className="rounded-lg border border-ink/10 bg-parchment p-5 shadow-ledger">
      <div className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-[0.2em] text-ink-faint">Documents</h3>
        {canEdit && (
          <button
            onClick={() => setModal({})}
            className="inline-flex items-center gap-1.5 rounded-sm bg-terracotta px-2.5 py-1.5 text-xs font-medium text-parchment transition hover:bg-terracotta-soft"
          >
            <Plus className="h-3.5 w-3.5" /> Add document
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {active.map((d) => (
          <DocRow
            key={d.id} doc={d}
            open={openDoc === d.id} onToggle={() => setOpenDoc(openDoc === d.id ? null : d.id)}
            canEdit={canEdit} onReplace={() => setModal({ replaces: d })}
          />
        ))}
        {active.length === 0 && <p className="text-sm text-ink-faint">No documents on record.</p>}
      </div>

      {/* superseded history (append-only trail) */}
      {superseded.length > 0 && (
        <div className="mt-4 border-t border-ink/5 pt-3">
          <button onClick={() => setShowHistory(!showHistory)} className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink">
            <History className="h-3.5 w-3.5" />
            {showHistory ? "Hide" : "Show"} superseded history ({superseded.length})
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-3 overflow-hidden"
              >
                {superseded.map((d) => (
                  <DocRow key={d.id} doc={d} open={openDoc === d.id} onToggle={() => setOpenDoc(openDoc === d.id ? null : d.id)} canEdit={false} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <AddDocModal
            propertyId={propertyId}
            replaces={modal.replaces}
            onClose={() => setModal(null)}
            onDone={() => { setModal(null); onChange(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DocRow({ doc, open, onToggle, canEdit, onReplace }: {
  doc: ManagedDoc; open: boolean; onToggle: () => void; canEdit: boolean; onReplace?: () => void;
}) {
  const s = statusStyle[doc.status] ?? statusStyle.OFFICIAL;
  return (
    <div className={`rounded-md border border-ink/10 p-3 ${doc.status === "SUPERSEDED" ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-ink-faint" />
            <span className="truncate text-sm font-medium text-ink">{labelFor(doc.type)}</span>
            <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: s.color, background: s.bg }}>
              {s.label}
            </span>
          </div>
          {/* key fields inline */}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
            {Object.entries(doc.extractedFields ?? {}).slice(0, 4).map(([k, v]) => (
              <span key={k}><span className="text-ink-faint">{k}:</span> {String(v)}</span>
            ))}
          </div>
          {doc.uploadedBy && (
            <p className="mt-1 text-[10px] text-ink-faint">
              by {doc.uploadedBy.name} ({doc.uploadedBy.role.toLowerCase()})
            </p>
          )}
          {doc.overrideReason && (
            <p className="mt-1 flex items-start gap-1 text-[10px] text-terracotta">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> Override: {doc.overrideReason}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-[11px] ${doc.ocrConfidence < 0.85 ? "text-terracotta" : "text-forest"}`}>
            {Math.round(doc.ocrConfidence * 100)}%
          </span>
          {doc.storageKey && (
            <button onClick={onToggle} className="rounded-sm border border-ink/20 p-1 text-ink transition hover:bg-ink hover:text-parchment" title={open ? "Hide" : "View"}>
              {open ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
          {canEdit && onReplace && (
            <button onClick={onReplace} className="rounded-sm border border-ink/20 p-1 text-ink transition hover:bg-ink hover:text-parchment" title="Replace (supersede)">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>{open && doc.storageKey && <DocViewer documentId={doc.id} />}</AnimatePresence>
    </div>
  );
}

// ---------- Add-document modal with conflict warning ----------
// `replaces` set → this upload supersedes an existing document: after the new
// doc is stored, we link old→new via PATCH /documents/:id/supersede.
function AddDocModal({ propertyId, replaces, onClose, onDone }: {
  propertyId: string; replaces?: ManagedDoc; onClose: () => void; onDone: () => void;
}) {
  const [type, setType] = useState(replaces?.type ?? "SALE_DEED");
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<{ key: string; value: string }[]>([
    { key: "area", value: "" },
    { key: "ownerName", value: "" },
  ]);
  const [ocrConfidence, setOcrConfidence] = useState(0.95);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function setField(i: number, patch: Partial<{ key: string; value: string }>) {
    setFields((f) => f.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function submit() {
    setError("");
    if (!file) { setError("Please choose a PDF or image file."); return; }
    setBusy(true);
    try {
      const extracted: Record<string, unknown> = {};
      for (const { key, value } of fields) {
        if (!key.trim() || value === "") continue;
        const num = Number(value);
        extracted[key.trim()] = value.trim() !== "" && !Number.isNaN(num) ? num : value;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      form.append("extractedFields", JSON.stringify(extracted));
      form.append("ocrConfidence", String(ocrConfidence));
      if (overrideReason.trim()) form.append("overrideReason", overrideReason.trim());

      const created = await apiUpload<{ id: string }>(`/api/properties/${propertyId}/documents`, form);
      // If this is a replacement, flip the old doc to SUPERSEDED and point it at
      // the new one (append-only — the old doc is kept for the audit trail).
      if (replaces) {
        await api(`/api/documents/${replaces.id}/supersede`, {
          method: "PATCH",
          body: JSON.stringify({ replacementId: created.id, reason: overrideReason.trim() || undefined }),
        });
      }
      onDone();
    } catch (e) {
      // 409 → the document contradicts the record. The backend returns the list
      // of contradictions; show them and require a typed reason to proceed.
      if (e instanceof ApiError && e.status === 409 && Array.isArray(e.body.conflicts)) {
        setConflicts(e.body.conflicts as Conflict[]);
        setBusy(false);
        return;
      }
      setError((e as Error).message || "Upload failed.");
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-ink/10 bg-parchment p-6 shadow-raised"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl text-ink">
            {replaces ? `Replace ${labelFor(replaces.type)}` : "Attach a document"}
          </h3>
          <button onClick={onClose}><X className="h-5 w-5 text-ink-faint hover:text-ink" /></button>
        </div>
        {replaces && (
          <p className="mt-1 text-xs text-ink-faint">
            The current document is kept in the record (marked superseded) — nothing is deleted.
          </p>
        )}

        {/* type */}
        <label className="mt-4 block text-sm text-ink-soft">Document type</label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {DOC_TYPES.map((t) => (
            <button
              key={t.v} type="button" onClick={() => setType(t.v)}
              className="rounded-sm border px-3 py-2 text-xs transition"
              style={{
                borderColor: type === t.v ? "#B5532A" : "rgba(27,42,65,0.2)",
                background: type === t.v ? "rgba(181,83,42,0.08)" : "transparent",
                color: type === t.v ? "#B5532A" : "#34435A",
              }}
            >{t.l}</button>
          ))}
        </div>

        {/* file */}
        <label className="mt-4 block text-sm text-ink-soft">File (PDF or image)</label>
        <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-sm border border-dashed border-ink/30 bg-white/50 px-3 py-3 text-sm text-ink-soft hover:border-terracotta">
          <Upload className="h-4 w-4" />
          {file ? file.name : "Choose a file…"}
          <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>

        {/* extracted fields */}
        <label className="mt-4 block text-sm text-ink-soft">Confirm the key fields (the engine cross-checks these)</label>
        <div className="mt-1 space-y-2">
          {fields.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={row.key} onChange={(e) => setField(i, { key: e.target.value })} placeholder="field"
                className="w-1/3 rounded-sm border border-ink/20 bg-white/60 px-2 py-1.5 text-sm outline-none focus:border-terracotta"
              />
              <input
                value={row.value} onChange={(e) => setField(i, { value: e.target.value })} placeholder="value"
                className="flex-1 rounded-sm border border-ink/20 bg-white/60 px-2 py-1.5 text-sm outline-none focus:border-terracotta"
              />
              <button onClick={() => setFields((f) => f.filter((_, idx) => idx !== i))} className="text-ink-faint hover:text-terracotta"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <button onClick={() => setFields((f) => [...f, { key: "", value: "" }])} className="text-xs text-terracotta hover:underline">+ add field</button>
        </div>

        {/* OCR confidence */}
        <label className="mt-4 block text-sm text-ink-soft">Read confidence: {Math.round(ocrConfidence * 100)}%</label>
        <input type="range" min={0.5} max={1} step={0.01} value={ocrConfidence} onChange={(e) => setOcrConfidence(Number(e.target.value))} className="mt-1 w-full accent-terracotta" />

        {/* CONFLICT WARNING */}
        <AnimatePresence>
          {conflicts && conflicts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg border-l-4 border-terracotta bg-terracotta/5 p-4"
            >
              <div className="flex items-center gap-2 text-terracotta">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-semibold">This contradicts the existing record</span>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-ink-soft">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <span className="font-medium text-ink">{c.field}:</span> record says <span className="font-medium">{c.existingValue}</span> ({labelFor(c.againstType)}), this says <span className="font-medium">{c.newValue}</span>
                  </li>
                ))}
              </ul>
              <label className="mt-3 block text-xs text-ink-soft">Reason for attaching anyway (recorded in the audit log)</label>
              <textarea
                value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2}
                placeholder="e.g. Survey re-measurement order dated 12 Jun supersedes the old area."
                className="mt-1 w-full rounded-sm border border-ink/20 bg-white/60 px-3 py-2 text-sm outline-none focus:border-terracotta"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="mt-3 text-sm text-seal">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-sm border border-ink/20 px-4 py-2 text-sm text-ink hover:bg-ink/5">Cancel</button>
          <button
            onClick={submit}
            disabled={busy || (conflicts !== null && conflicts.length > 0 && !overrideReason.trim())}
            className="inline-flex items-center gap-2 rounded-sm bg-terracotta px-4 py-2 text-sm font-medium text-parchment transition hover:bg-terracotta-soft disabled:opacity-50"
          >
            {conflicts && conflicts.length > 0 ? <ShieldCheck className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {busy ? "Uploading…" : conflicts && conflicts.length > 0 ? "Attach with reason" : "Upload"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
