// Verification-request routes — the formal citizen→officer handoff.
//
// A citizen opens a request against a property ("I'm about to buy this, check
// it"). It lands in the officer queue, scoped to the officer's district. The
// officer picks it up (IN_REVIEW) and later resolves it (CLEARED / FLAGGED /
// REJECTED) with a note back to the citizen. Every state change is audited.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";

export const requestRouter = Router();
requestRouter.use(authenticate);

// ---------- CITIZEN: open a request ----------
const createSchema = z.object({
  propertyId: z.string().min(1),
  purpose: z.enum(["PURCHASE", "LOAN", "INHERITANCE", "GENERAL"]).default("GENERAL"),
  note: z.string().max(500).optional(),
});

requestRouter.post("/", requireRole("CITIZEN"), async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const property = await prisma.property.findUnique({ where: { id: parsed.data.propertyId } });
  if (!property) return res.status(404).json({ error: "Property not found" });

  const created = await prisma.verificationRequest.create({
    data: {
      propertyId: parsed.data.propertyId,
      requesterId: req.user!.userId,
      purpose: parsed.data.purpose,
      note: parsed.data.note,
    },
  });
  await writeAudit({
    actorId: req.user!.userId, action: "REQUEST_OPEN",
    entity: "VerificationRequest", entityId: created.id, after: { status: "SUBMITTED" },
  });
  res.json(created);
});

// ---------- CITIZEN: my requests (the tracker) ----------
requestRouter.get("/mine", requireRole("CITIZEN"), async (req: AuthedRequest, res) => {
  const items = await prisma.verificationRequest.findMany({
    where: { requesterId: req.user!.userId },
    include: {
      property: { select: { id: true, surveyNo: true, village: true, taluk: true, district: true, status: true } },
      officer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

// ---------- OFFICER / AUTHORITY: the caseload queue ----------
// Officers see only their own district; authorities see region-wide.
requestRouter.get("/queue", requireRole("OFFICER", "AUTHORITY"), async (req: AuthedRequest, res) => {
  const where: { property?: { district: string } } = {};
  if (req.user?.role === "OFFICER" && req.user.jurisdiction) {
    where.property = { district: req.user.jurisdiction };
  }
  const items = await prisma.verificationRequest.findMany({
    where,
    include: {
      property: {
        select: {
          id: true, surveyNo: true, village: true, taluk: true, district: true, status: true,
          healthScores: { orderBy: { computedAt: "desc" }, take: 1 },
          findings: { select: { severity: true } },
        },
      },
      requester: { select: { name: true } },
      officer: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  // flatten latestScore for the UI
  res.json(
    items.map((it) => ({
      ...it,
      property: {
        ...it.property,
        latestScore: it.property.healthScores[0]?.score ?? null,
        criticalCount: it.property.findings.filter((f) => f.severity === "CRITICAL").length,
        healthScores: undefined,
        findings: undefined,
      },
    })),
  );
});

// ---------- OFFICER: pick up a case (SUBMITTED -> IN_REVIEW) ----------
requestRouter.patch("/:id/claim", requireRole("OFFICER", "AUTHORITY"), async (req: AuthedRequest, res) => {
  const existing = await prisma.verificationRequest.findUnique({
    where: { id: req.params.id }, include: { property: true },
  });
  if (!existing) return res.status(404).json({ error: "Request not found" });
  // jurisdiction guard for officers
  if (req.user?.role === "OFFICER" && req.user.jurisdiction && existing.property.district !== req.user.jurisdiction) {
    return res.status(403).json({ error: "Outside your jurisdiction" });
  }

  const updated = await prisma.verificationRequest.update({
    where: { id: req.params.id },
    data: { status: "IN_REVIEW", officerId: req.user!.userId },
  });
  await writeAudit({
    actorId: req.user!.userId, action: "REQUEST_CLAIM",
    entity: "VerificationRequest", entityId: updated.id,
    before: { status: existing.status }, after: { status: "IN_REVIEW" },
  });
  res.json(updated);
});

// ---------- OFFICER: resolve a case ----------
const resolveSchema = z.object({
  status: z.enum(["CLEARED", "FLAGGED", "REJECTED"]),
  officerNote: z.string().max(1000).optional(),
});

requestRouter.patch("/:id/resolve", requireRole("OFFICER", "AUTHORITY"), async (req: AuthedRequest, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.verificationRequest.findUnique({
    where: { id: req.params.id }, include: { property: true },
  });
  if (!existing) return res.status(404).json({ error: "Request not found" });
  if (req.user?.role === "OFFICER" && req.user.jurisdiction && existing.property.district !== req.user.jurisdiction) {
    return res.status(403).json({ error: "Outside your jurisdiction" });
  }

  const updated = await prisma.verificationRequest.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status, officerNote: parsed.data.officerNote, officerId: req.user!.userId },
  });
  await writeAudit({
    actorId: req.user!.userId, action: "REQUEST_RESOLVE",
    entity: "VerificationRequest", entityId: updated.id,
    before: { status: existing.status }, after: { status: parsed.data.status },
  });
  res.json(updated);
});
