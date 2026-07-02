// Audit log viewer — authority/admin only. Read-only timeline of who did what.
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";

export const auditRouter = Router();
auditRouter.use(authenticate, requireRole("AUTHORITY", "ADMIN"));

// GET /api/audit?entity=Finding&entityId=...
auditRouter.get("/", async (req, res) => {
  const { entity, entityId } = req.query as { entity?: string; entityId?: string };
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(entity ? { entity } : {}),
      ...(entityId ? { entityId } : {}),
    },
    include: { actor: { select: { name: true, role: true } } },
    orderBy: { timestamp: "desc" },
    take: 200,
  });
  res.json(logs);
});
