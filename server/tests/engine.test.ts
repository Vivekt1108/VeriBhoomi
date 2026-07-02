// Unit tests for the fraud engine.
// Each test builds a tiny hand-made PropertyGraph and checks the right rule fires.
// Run with: npm test
import { describe, it, expect } from "vitest";
import { analyze } from "../src/engine/index.js";
import type { PropertyGraph } from "../src/engine/types.js";

// a clean, empty-ish property to start from; tests add the problem they want
function baseGraph(): PropertyGraph {
  return {
    propertyId: "p1",
    surveyNo: "SY-1",
    area: 2400,
    parties: [
      { id: "A", name: "Asha" },
      { id: "B", name: "Bhavna" },
      { id: "C", name: "Chetan" },
    ],
    ownerships: [],
    inheritances: [],
    documents: [],
    taxRecords: [],
    disputes: [],
    encumbrances: [],
  };
}

const d = (s: string) => new Date(s);

describe("fraud engine", () => {
  it("a clean property scores 100 with no findings", () => {
    const g = baseGraph();
    g.ownerships = [{ id: "o1", ownerId: "A", fromDate: d("2010-01-01"), toDate: null }];
    const { findings, score } = analyze(g);
    expect(findings).toHaveLength(0);
    expect(score.score).toBe(100);
    expect(score.riskBand).toBe("LOW");
  });

  it("detects double-selling (overlapping owners)", () => {
    const g = baseGraph();
    g.ownerships = [
      { id: "o1", ownerId: "A", fromDate: d("2015-01-01"), toDate: d("2020-01-01") },
      { id: "o2", ownerId: "B", fromDate: d("2018-01-01"), toDate: d("2022-01-01") },
    ];
    const { findings } = analyze(g);
    expect(findings.some((f) => f.ruleKey === "DOUBLE_SELLING")).toBe(true);
  });

  it("detects a broken chain of title (long gap)", () => {
    const g = baseGraph();
    g.ownerships = [
      { id: "o1", ownerId: "A", fromDate: d("2000-01-01"), toDate: d("2005-01-01") },
      { id: "o2", ownerId: "B", fromDate: d("2010-01-01"), toDate: null },
    ];
    const { findings } = analyze(g);
    expect(findings.some((f) => f.ruleKey === "BROKEN_CHAIN")).toBe(true);
  });

  it("detects inheritance conflict (owner is not the heir)", () => {
    const g = baseGraph();
    g.inheritances = [{ id: "i1", fromId: "A", toId: "B", date: d("2019-01-01") }];
    // C takes over soon after, but B was the heir
    g.ownerships = [{ id: "o1", ownerId: "C", fromDate: d("2019-06-01"), toDate: null }];
    const { findings } = analyze(g);
    expect(findings.some((f) => f.ruleKey === "INHERITANCE_CONFLICT")).toBe(true);
  });

  it("detects tax paid by a non-owner", () => {
    const g = baseGraph();
    g.ownerships = [{ id: "o1", ownerId: "A", fromDate: d("2010-01-01"), toDate: null }];
    g.taxRecords = [{ id: "t1", payerId: "C", year: 2021 }];
    const { findings } = analyze(g);
    expect(findings.some((f) => f.ruleKey === "TAX_PAYER_MISMATCH")).toBe(true);
  });

  it("detects a hidden active lien against a clear-title claim", () => {
    const g = baseGraph();
    g.documents = [
      { id: "doc1", type: "SALE_DEED", extractedFields: { titleStatus: "Clear" }, ocrConfidence: 0.9 },
    ];
    g.encumbrances = [{ id: "e1", active: true, amount: 500000 }];
    const { findings } = analyze(g);
    const lien = findings.find((f) => f.ruleKey === "HIDDEN_LIEN");
    expect(lien?.severity).toBe("CRITICAL");
  });

  it("detects an area mismatch beyond tolerance", () => {
    const g = baseGraph(); // official 2400
    g.documents = [
      { id: "doc1", type: "MUTATION", extractedFields: { area: 2000 }, ocrConfidence: 0.8 },
    ];
    const { findings } = analyze(g);
    expect(findings.some((f) => f.ruleKey === "AREA_MISMATCH")).toBe(true);
  });

  it("detects active litigation", () => {
    const g = baseGraph();
    g.disputes = [
      { id: "x1", status: "OPEN", caseNo: "OS/123/2022", court: "Civil Court", partyIds: ["A", "B"] },
    ];
    const { findings, score } = analyze(g);
    expect(findings.some((f) => f.ruleKey === "ACTIVE_LITIGATION")).toBe(true);
    expect(score.score).toBeLessThan(100);
  });

  it("detects circular ownership (A -> B -> A)", () => {
    const g = baseGraph();
    g.ownerships = [
      { id: "o1", ownerId: "A", fromDate: d("2000-01-01"), toDate: d("2005-01-01") },
      { id: "o2", ownerId: "B", fromDate: d("2005-01-01"), toDate: d("2010-01-01") },
      { id: "o3", ownerId: "A", fromDate: d("2010-01-01"), toDate: null },
    ];
    const { findings } = analyze(g);
    expect(findings.some((f) => f.ruleKey === "CIRCULAR_OWNERSHIP")).toBe(true);
  });
});
