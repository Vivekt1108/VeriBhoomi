// Types for the fraud engine.
// The engine is a PURE module: give it a PropertyGraph, get back Findings.
// No database calls, no AI, no side effects — just logic. This makes it
// trivial to unit-test and means it runs with zero external API.

export type Severity = "CRITICAL" | "WARNING" | "INFO";

// A finding the engine produces. linkedRecordIds points at the exact records
// that triggered it, so the UI can highlight them — full transparency.
export interface RuleFinding {
  ruleKey: string;
  severity: Severity;
  title: string;
  description: string;
  linkedRecordIds: string[];
}

// Plain shapes of the data the engine reads. These mirror the Prisma models
// but are deliberately decoupled so the engine never imports Prisma — that's
// what lets us test it with hand-made fixtures.
export interface PartyLite {
  id: string;
  name: string;
}

export interface OwnershipLite {
  id: string;
  ownerId: string;
  fromDate: Date;
  toDate: Date | null; // null = current
}

export interface InheritanceLite {
  id: string;
  fromId: string;
  toId: string;
  date: Date;
}

export interface DocumentLite {
  id: string;
  type: string;
  extractedFields: Record<string, unknown>;
  ocrConfidence: number;
}

export interface TaxLite {
  id: string;
  payerId: string;
  year: number;
}

export interface DisputeLite {
  id: string;
  status: "OPEN" | "CLOSED" | "STAYED";
  caseNo: string;
  court: string;
  partyIds: string[];
}

export interface EncumbranceLite {
  id: string;
  active: boolean;
  amount: number;
}

// The whole web of one property, as the engine sees it.
export interface PropertyGraph {
  propertyId: string;
  surveyNo: string;
  area: number; // sq ft, the "official" record value
  parties: PartyLite[];
  ownerships: OwnershipLite[];
  inheritances: InheritanceLite[];
  documents: DocumentLite[];
  taxRecords: TaxLite[];
  disputes: DisputeLite[];
  encumbrances: EncumbranceLite[];
}

// Every rule is just a function with this signature.
export type Rule = (g: PropertyGraph) => RuleFinding[];

// Helper for rules to look up a party name for nicer messages.
export function partyName(g: PropertyGraph, id: string): string {
  return g.parties.find((p) => p.id === id)?.name ?? "Unknown party";
}
