// Deterministic "smart" document summariser.
//
// This reads the documents attached to a plot (and their OCR-extracted fields)
// and produces a plain-language summary + a per-document explanation — the kind
// of thing a citizen needs to understand WHY a plot is risky or safe.
//
// IMPORTANT: this uses ZERO external/paid LLM calls. It is pure rules over the
// structured data, so it keeps working forever and on any machine. The shape of
// the output (a headline + bullet points + per-doc notes) is deliberately the
// same shape a language model would return, so a LOCAL model (e.g. Ollama) can
// be slotted in later for nicer prose without changing any callers. See
// summarizeDossier() — swap the body, keep the return type.

export interface RawDoc {
  id: string;
  type: string;                       // DocumentType enum value
  ocrConfidence: number;              // 0..1
  extractedFields: Record<string, unknown>;
  createdAt: Date;
  hasFile: boolean;                   // is an actual scan attached?
  status: string;                     // OFFICIAL | PENDING
}

export interface DossierInput {
  documents: RawDoc[];
  counts: { owners: number; liens: number; disputes: number };
  criticalCount: number;
  warningCount: number;
}

// What each document type is FOR — shown so a citizen knows why it matters.
const DOC_META: Record<string, { label: string; purpose: string }> = {
  SALE_DEED:        { label: "Sale Deed",               purpose: "Records a transfer of ownership and the agreed plot area." },
  MUTATION:         { label: "Mutation / Khata",        purpose: "Updates the revenue record to show the current owner." },
  TAX_RECEIPT:      { label: "Property Tax Receipt",    purpose: "Shows that property tax has been paid for a given year." },
  ENCUMBRANCE_CERT: { label: "Encumbrance Certificate", purpose: "Lists any loans or charges registered against the plot." },
  GOVT_APPROVAL:    { label: "Government Approval",      purpose: "Confirms the land's permitted use and approvals." },
};

const labelFor = (t: string) => DOC_META[t]?.label ?? t.replace(/_/g, " ");

// Mask a personal name: "Asha Nair" -> "A•••• N•••". The citizen sees that a
// name is on record without us leaking the identity (privacy boundary — full
// names go only to the verifying officer).
function maskName(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "—";
  return s
    .split(/\s+/)
    .map((w) => (w[0] ?? "") + "•".repeat(Math.max(2, w.length - 1)))
    .join(" ");
}

const NAME_KEYS = /(name|owner|payer|lender|party|seller|buyer)/i;

// Produce a display-safe copy of a document's fields: keep areas/dates/status,
// mask anything that looks like a person's name.
function sanitizeFields(fields: Record<string, unknown>): { key: string; value: string }[] {
  return Object.entries(fields).map(([key, value]) => ({
    key,
    value: NAME_KEYS.test(key) ? maskName(value) : String(value),
  }));
}

// Pull every numeric "area" the documents declare, so we can cross-check them.
function areasFrom(docs: RawDoc[]): number[] {
  const out: number[] = [];
  for (const d of docs) {
    const a = d.extractedFields["area"];
    if (typeof a === "number") out.push(a);
  }
  return out;
}

export interface DocOut {
  id: string;
  type: string;
  label: string;
  purpose: string;
  confidence: number;
  confidenceNote: string;       // plain-language read of the OCR confidence
  fields: { key: string; value: string }[];
  hasFile: boolean;             // can the citizen open an actual scan?
  status: string;               // OFFICIAL | PENDING
}

export interface DossierSummary {
  headline: string;
  points: { tone: "good" | "warn" | "bad" | "info"; text: string }[];
  documents: DocOut[];
}

// THE summariser. Deterministic today; same signature a local LLM would fill.
export function summarizeDossier(input: DossierInput): DossierSummary {
  const { documents, counts, criticalCount, warningCount } = input;

  const points: DossierSummary["points"] = [];

  // 1) Cross-check the plot area across documents — the project's core thesis:
  //    fraud hides in CONTRADICTIONS between papers, not inside any one of them.
  const areas = areasFrom(documents);
  const distinctAreas = [...new Set(areas)];
  if (distinctAreas.length > 1) {
    points.push({
      tone: "bad",
      text: `The documents disagree on the plot size (${distinctAreas.join(" vs ")} sqft). A mismatch like this is a classic sign of an altered or wrongly-linked record.`,
    });
  } else if (distinctAreas.length === 1) {
    points.push({
      tone: "good",
      text: `Every document agrees the plot is ${distinctAreas[0]} sqft.`,
    });
  }

  // 2) Money / legal charges on the plot.
  if (counts.liens > 0) {
    points.push({
      tone: "bad",
      text: `${counts.liens} loan/charge${counts.liens > 1 ? "s are" : " is"} registered against this plot. It cannot be sold cleanly until ${counts.liens > 1 ? "they are" : "it is"} cleared.`,
    });
  } else {
    points.push({ tone: "good", text: "No active loans or charges are registered against the plot." });
  }

  // 3) Active litigation.
  if (counts.disputes > 0) {
    points.push({
      tone: "bad",
      text: `${counts.disputes} court dispute${counts.disputes > 1 ? "s are" : " is"} attached to this plot. Ownership may be contested.`,
    });
  }

  // 4) Ownership chain length.
  if (counts.owners > 0) {
    points.push({
      tone: "info",
      text: `${counts.owners} owner${counts.owners > 1 ? "s appear" : " appears"} in the chain of title.`,
    });
  }

  // 5) OCR confidence — documents the engine wasn't sure it read correctly.
  const lowConf = documents.filter((d) => d.ocrConfidence < 0.85);
  if (lowConf.length > 0) {
    points.push({
      tone: "warn",
      text: `${lowConf.length} document${lowConf.length > 1 ? "s were" : " was"} scanned with low confidence — an officer should re-check the original${lowConf.length > 1 ? "s" : ""}.`,
    });
  }

  // 6) Roll up the engine's own findings count.
  if (criticalCount > 0) {
    points.push({ tone: "bad", text: `${criticalCount} critical contradiction${criticalCount > 1 ? "s" : ""} found by the analysis engine.` });
  } else if (warningCount > 0) {
    points.push({ tone: "warn", text: `${warningCount} minor issue${warningCount > 1 ? "s" : ""} worth confirming before you pay.` });
  }

  // Headline: a one-liner that reflects the worst thing we saw.
  let headline: string;
  if (criticalCount > 0 || counts.disputes > 0 || distinctAreas.length > 1) {
    headline = "These documents contradict each other — read the points below carefully before paying anything.";
  } else if (warningCount > 0 || counts.liens > 0) {
    headline = "Mostly consistent, but a few things need an officer's confirmation.";
  } else if (documents.length === 0) {
    headline = "No documents are on record for this plot yet.";
  } else {
    headline = "The documents on record are consistent with each other.";
  }

  const docOut: DocOut[] = documents.map((d) => ({
    id: d.id,
    type: d.type,
    label: labelFor(d.type),
    purpose: DOC_META[d.type]?.purpose ?? "Supporting document.",
    confidence: d.ocrConfidence,
    confidenceNote:
      d.ocrConfidence >= 0.95 ? "Read clearly"
      : d.ocrConfidence >= 0.85 ? "Read with minor uncertainty"
      : "Low confidence — needs an officer's eyes",
    fields: sanitizeFields(d.extractedFields),
    hasFile: d.hasFile,
    status: d.status,
  }));

  return { headline, points, documents: docOut };
}
