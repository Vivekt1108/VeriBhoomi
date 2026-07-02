// Property routes: list, get full detail (the relationship web), and the
// analyze endpoint that runs the fraud engine and persists findings + score.
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";
import { buildPropertyGraph } from "../engine/buildGraph.js";
import { analyze } from "../engine/index.js";

export const propertyRouter = Router();

// everything here needs a logged-in user
propertyRouter.use(authenticate);

// GET /api/properties — list (citizens see summary only)
propertyRouter.get("/", async (_req, res) => {
  const properties = await prisma.property.findMany({
    select: {
      id: true, surveyNo: true, khataNo: true, area: true,
      district: true, taluk: true, village: true, status: true,
      healthScores: { orderBy: { computedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(
    properties.map((p) => ({
      ...p,
      latestScore: p.healthScores[0]?.score ?? null,
      healthScores: undefined,
    })),
  );
});

// GET /api/properties/:id — full relationship web for the report page
propertyRouter.get("/:id", async (req: AuthedRequest, res) => {
  const property = await prisma.property.findUnique({
    where: { id: req.params.id },
    include: {
      ownerships: { include: { owner: true }, orderBy: { fromDate: "asc" } },
      inheritances: { include: { fromParty: true, toParty: true } },
      documents: {
        include: { uploadedBy: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      taxRecords: { include: { payer: true } },
      approvals: true,
      disputes: { include: { parties: { include: { party: true } } } },
      encumbrances: { include: { lender: true } },
      findings: { orderBy: { severity: "asc" }, include: { verifiedBy: { select: { name: true } } } },
      healthScores: { orderBy: { computedAt: "desc" }, take: 1 },
    },
  });
  if (!property) return res.status(404).json({ error: "Property not found" });

  if (req.user) {
    await writeAudit({ actorId: req.user.userId, action: "VIEW", entity: "Property", entityId: property.id });
  }
  res.json(property);
});

// POST /api/properties/:id/analyze — run the fraud engine, save findings + score
propertyRouter.post("/:id/analyze", async (req: AuthedRequest, res) => {
  const graph = await buildPropertyGraph(req.params.id);
  if (!graph) return res.status(404).json({ error: "Property not found" });

  const { findings, score } = analyze(graph);

  // replace previous machine findings (keep nothing stale), then persist fresh
  await prisma.finding.deleteMany({ where: { propertyId: graph.propertyId, humanVerified: false } });
  await prisma.finding.createMany({
    data: findings.map((f) => ({
      propertyId: graph.propertyId,
      ruleKey: f.ruleKey,
      severity: f.severity,
      title: f.title,
      description: f.description,
      linkedRecordIds: f.linkedRecordIds,
    })),
  });
  const saved = await prisma.healthScore.create({
    data: { propertyId: graph.propertyId, score: score.score, breakdown: score.breakdown as object },
  });

  if (req.user) {
    await writeAudit({ actorId: req.user.userId, action: "ANALYZE", entity: "Property", entityId: graph.propertyId, after: { score: score.score } });
  }

  res.json({ findings, score, healthScoreId: saved.id });
});
