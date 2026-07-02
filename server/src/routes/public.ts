// Public / citizen-facing routes.
//
// A citizen does NOT get the officer's forensic view (party names, court
// case numbers, lender details). They get a SANITISED trust summary: a verdict,
// the score, and plain-language risk flags. This is a deliberate privacy
// boundary — least privilege applied to data shape, not just endpoints.
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";
import { summarizeDossier } from "../lib/docSummary.js";

export const publicRouter = Router();
publicRouter.use(authenticate);

// GET /api/public/search?q=koramangala  — search by survey no / village / khata
publicRouter.get("/search", async (req: AuthedRequest, res) => {
  const q = String((req.query.q ?? "")).trim();
  if (q.length < 2) return res.json([]);
  const properties = await prisma.property.findMany({
    where: {
      OR: [
        { surveyNo: { contains: q, mode: "insensitive" } },
        { village: { contains: q, mode: "insensitive" } },
        { khataNo: { contains: q, mode: "insensitive" } },
        { taluk: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true, surveyNo: true, khataNo: true, area: true,
      village: true, taluk: true, district: true, status: true,
      healthScores: { orderBy: { computedAt: "desc" }, take: 1 },
    },
    take: 12,
  });
  res.json(
    properties.map((p) => ({
      id: p.id, surveyNo: p.surveyNo, khataNo: p.khataNo, area: p.area,
      village: p.village, taluk: p.taluk, district: p.district, status: p.status,
      latestScore: p.healthScores[0]?.score ?? null,
    })),
  );
});

// Map a risk band + finding mix into a plain-language verdict for the public.
function verdictFor(score: number | null, criticalCount: number) {
  if (score === null) return { band: "UNKNOWN", verdict: "Not yet verified", advice: "This property has not been analysed yet. Request a verification to get a report." };
  if (criticalCount > 0 || score < 45) return { band: "HIGH", verdict: "High risk — do not proceed without an officer", advice: "Serious contradictions were found in the records. Treat any sale with extreme caution until an officer reviews it." };
  if (score < 75) return { band: "MEDIUM", verdict: "Some caution advised", advice: "Minor issues were found. Worth getting an officer to confirm before any large payment." };
  return { band: "LOW", verdict: "Looks safe on record", advice: "No major contradictions found in the available records. Still verify identities before paying." };
}

// GET /api/public/property/:id — the sanitised trust report a citizen sees.
publicRouter.get("/property/:id", async (req: AuthedRequest, res) => {
  const property = await prisma.property.findUnique({
    where: { id: req.params.id },
    include: {
      findings: { select: { severity: true, title: true, description: true, humanVerified: true } },
      healthScores: { orderBy: { computedAt: "desc" }, take: 1 },
      ownerships: { where: { toDate: null }, include: { owner: { select: { name: true } } }, take: 1 },
      documents: { where: { status: "OFFICIAL" }, select: { id: true, type: true, ocrConfidence: true, extractedFields: true, createdAt: true, storageKey: true, status: true }, orderBy: { createdAt: "asc" } },
      _count: { select: { ownerships: true, encumbrances: true, disputes: true, documents: true } },
    },
  });
  if (!property) return res.status(404).json({ error: "Property not found" });

  const score = property.healthScores[0]?.score ?? null;
  const criticalCount = property.findings.filter((f) => f.severity === "CRITICAL").length;
  const warningCount = property.findings.filter((f) => f.severity === "WARNING").length;

  // Deterministic "smart" dossier summary + sanitised document list.
  const dossier = summarizeDossier({
    documents: property.documents.map((d) => ({
      id: d.id,
      type: d.type,
      ocrConfidence: d.ocrConfidence,
      extractedFields: (d.extractedFields ?? {}) as Record<string, unknown>,
      createdAt: d.createdAt,
      hasFile: Boolean(d.storageKey),
      status: d.status,
    })),
    counts: {
      owners: property._count.ownerships,
      liens: property._count.encumbrances,
      disputes: property._count.disputes,
    },
    criticalCount,
    warningCount,
  });

  if (req.user) {
    await writeAudit({ actorId: req.user.userId, action: "PUBLIC_VIEW", entity: "Property", entityId: property.id });
  }

  res.json({
    id: property.id,
    surveyNo: property.surveyNo,
    khataNo: property.khataNo,
    area: property.area,
    village: property.village,
    taluk: property.taluk,
    district: property.district,
    status: property.status,
    score,
    ...verdictFor(score, criticalCount),
    currentOwner: property.ownerships[0]?.owner.name ?? null,
    counts: {
      critical: criticalCount,
      warning: warningCount,
      owners: property._count.ownerships,
      liens: property._count.encumbrances,
      disputes: property._count.disputes,
      documents: property._count.documents,
    },
    // plain-language flags only — no party names, no case numbers
    flags: property.findings.map((f) => ({
      severity: f.severity,
      title: f.title,
      verified: f.humanVerified,
    })),
    // smart summary + the document dossier (sanitised, read-only for citizens)
    dossier,
  });
});
