// Conflict detection for document uploads.
//
// The project's thesis: fraud lives in the CONTRADICTIONS between documents.
// So before an officer attaches a new document, we compare its extracted fields
// against the documents already on the plot's official record. If they disagree
// on something material (plot area, owner name), we surface that — the officer
// must then confirm with a reason (logged), rather than the conflict slipping
// in silently. This is deterministic, no LLM.

export interface ConflictDoc {
  type: string;
  extractedFields: Record<string, unknown>;
}

export interface Conflict {
  field: string;          // e.g. "area"
  existingValue: string;  // what the record already says
  newValue: string;       // what the incoming doc says
  againstType: string;    // the document type it disagrees with
}

// Normalise a value for comparison: numbers compared numerically, strings
// case-insensitively and trimmed.
function norm(v: unknown): string {
  if (typeof v === "number") return String(v);
  return String(v ?? "").trim().toLowerCase();
}

// Fields we treat as material enough to block on. Owner-name keys vary, so we
// match loosely.
const NAME_KEY = /(ownername|owner|payername|payer)/i;

// Compare an incoming document against every existing OFFICIAL document on the
// plot. Returns every material disagreement found.
export function findConflicts(incoming: ConflictDoc, existing: ConflictDoc[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const inFields = incoming.extractedFields ?? {};

  // 1) Plot area must agree across documents.
  const inArea = inFields["area"];
  if (typeof inArea === "number") {
    for (const doc of existing) {
      const exArea = doc.extractedFields?.["area"];
      if (typeof exArea === "number" && exArea !== inArea) {
        conflicts.push({
          field: "area",
          existingValue: `${exArea} sqft`,
          newValue: `${inArea} sqft`,
          againstType: doc.type,
        });
      }
    }
  }

  // 2) Owner / payer name should not contradict an existing owner name.
  const inOwnerKey = Object.keys(inFields).find((k) => NAME_KEY.test(k));
  const inOwner = inOwnerKey ? norm(inFields[inOwnerKey]) : "";
  if (inOwner) {
    for (const doc of existing) {
      const exKey = Object.keys(doc.extractedFields ?? {}).find((k) => NAME_KEY.test(k));
      const exOwner = exKey ? norm(doc.extractedFields[exKey]) : "";
      if (exOwner && exOwner !== inOwner) {
        conflicts.push({
          field: "owner name",
          existingValue: String(doc.extractedFields[exKey!]),
          newValue: String(inFields[inOwnerKey!]),
          againstType: doc.type,
        });
      }
    }
  }

  return conflicts;
}
