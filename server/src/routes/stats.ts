// Aggregate stats for the officer & authority dashboards.
//
// Officers get figures scoped to their district; authorities get the whole
// region. Everything here is read-only aggregation the frontend turns into
// stat tiles, charts and the map.
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole, type AuthedRequest } from "../middleware/auth.js";

export const statsRouter = Router();
statsRouter.use(authenticate, requireRole("OFFICER", "AUTHORITY"));

// district filter: officers are pinned to their jurisdiction, authorities see all
function districtFilter(req: AuthedRequest) {
  if (req.user?.role === "OFFICER" && req.user.jurisdiction) {
    return { district: req.user.jurisdiction };
  }
  return {};
}

// GET /api/stats/overview — the dashboard numbers + chart series + map pins
statsRouter.get("/overview", async (req: AuthedRequest, res) => {
  const where = districtFilter(req);

  const properties = await prisma.property.findMany({
    where,
    select: {
      id: true, surveyNo: true, village: true, taluk: true, district: true,
      status: true, lat: true, lng: true,
      healthScores: { orderBy: { computedAt: "desc" }, take: 1 },
      findings: { select: { severity: true, humanVerified: true } },
    },
  });

  // status breakdown (for the donut chart)
  const byStatus = { CLEAR: 0, UNDER_REVIEW: 0, DISPUTED: 0, FLAGGED: 0 } as Record<string, number>;
  // taluk breakdown (for the bar chart)
  const byTaluk: Record<string, { total: number; flagged: number }> = {};
  let critical = 0, warning = 0, info = 0, verified = 0, scored = 0, scoreSum = 0;

  for (const p of properties) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    byTaluk[p.taluk] ??= { total: 0, flagged: 0 };
    byTaluk[p.taluk].total += 1;
    if (p.status === "FLAGGED" || p.status === "DISPUTED") byTaluk[p.taluk].flagged += 1;
    for (const f of p.findings) {
      if (f.severity === "CRITICAL") critical += 1;
      else if (f.severity === "WARNING") warning += 1;
      else info += 1;
      if (f.humanVerified) verified += 1;
    }
    const s = p.healthScores[0]?.score;
    if (typeof s === "number") { scored += 1; scoreSum += s; }
  }

  // verification-request funnel
  const reqWhere = where.district ? { property: { district: where.district } } : {};
  const requests = await prisma.verificationRequest.findMany({
    where: reqWhere, select: { status: true },
  });
  const byRequest = { SUBMITTED: 0, IN_REVIEW: 0, CLEARED: 0, FLAGGED: 0, REJECTED: 0 } as Record<string, number>;
  for (const r of requests) byRequest[r.status] = (byRequest[r.status] ?? 0) + 1;

  res.json({
    scope: where.district ?? "All regions",
    totals: {
      properties: properties.length,
      flagged: byStatus.FLAGGED + byStatus.DISPUTED,
      pendingRequests: byRequest.SUBMITTED + byRequest.IN_REVIEW,
      criticalFindings: critical,
      avgScore: scored ? Math.round(scoreSum / scored) : null,
    },
    findings: { critical, warning, info, verified },
    byStatus,
    byTaluk: Object.entries(byTaluk).map(([taluk, v]) => ({ taluk, ...v })),
    byRequest,
    // map pins — only properties that actually have coordinates
    pins: properties
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({
        id: p.id, surveyNo: p.surveyNo, village: p.village, status: p.status,
        lat: p.lat, lng: p.lng, score: p.healthScores[0]?.score ?? null,
      })),
  });
});
