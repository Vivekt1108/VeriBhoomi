// Finding routes — the human-in-the-loop layer.
// Officers/authorities verify or override a machine finding. Every action is
// audited with before/after so the human decision is traceable.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";

export const findingRouter = Router();
findingRouter.use(authenticate);

// GET /api/findings/queue — findings awaiting human verification (officers+)
findingRouter.get("/queue", requireRole("OFFICER", "AUTHORITY"), async (req: AuthedRequest, res) => {
  const where: { humanVerified: boolean; property?: { district: string } } = { humanVerified: false };
  // officers see only their jurisdiction; authorities region-wide
  if (req.user?.role === "OFFICER" && req.user.jurisdiction) {
    where.property = { district: req.user.jurisdiction };
  }
  const findings = await prisma.finding.findMany({
    where,
    include: { property: { select: { surveyNo: true, village: true, district: true } } },
    orderBy: { severity: "asc" },
  });
  res.json(findings);
});

const verifySchema = z.object({
  humanVerified: z.boolean(),
  expertNotes: z.string().optional(),
});

// PATCH /api/findings/:id/verify — verify or override a finding
findingRouter.patch("/:id/verify", requireRole("OFFICER", "AUTHORITY"), async (req: AuthedRequest, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const before = await prisma.finding.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Finding not found" });

  const updated = await prisma.finding.update({
    where: { id: req.params.id },
    data: {
      humanVerified: parsed.data.humanVerified,
      expertNotes: parsed.data.expertNotes,
      verifiedById: req.user!.userId,
      verifiedAt: new Date(),
    },
  });

  await writeAudit({
    actorId: req.user!.userId,
    action: parsed.data.humanVerified ? "VERIFY" : "OVERRIDE",
    entity: "Finding",
    entityId: updated.id,
    before: { humanVerified: before.humanVerified, expertNotes: before.expertNotes },
    after: { humanVerified: updated.humanVerified, expertNotes: updated.expertNotes },
  });

  res.json(updated);
});
