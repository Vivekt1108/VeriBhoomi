// Admin routes — user & role management only.
//
// Separation of duty: an admin manages WHO can use the system and what role
// they hold, but does not touch citizens' private property data or verify
// findings. Every change is audited.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/auth.js";
import { authenticate, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole("ADMIN"));

// GET /api/admin/users — list everyone with a per-user activity count
adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, name: true, email: true, role: true, jurisdiction: true, createdAt: true,
      _count: { select: { verifiedFindings: true, requestsHandled: true, requestsMade: true } },
    },
  });
  res.json(users);
});

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["CITIZEN", "OFFICER", "AUTHORITY", "ADMIN"]),
  jurisdiction: z.string().optional().nullable(),
});

// POST /api/admin/users — provision a staff user (or any role)
adminRouter.post("/users", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, email, password, role, jurisdiction } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  // officers/authorities need a jurisdiction; citizens/admins don't
  const juris = role === "OFFICER" || role === "AUTHORITY" ? jurisdiction ?? null : null;

  const user = await prisma.user.create({
    data: { name, email, role, jurisdiction: juris, passwordHash: await hashPassword(password) },
  });
  await writeAudit({
    actorId: req.user!.userId, action: "USER_CREATE", entity: "User", entityId: user.id,
    after: { role, jurisdiction: juris },
  });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, jurisdiction: user.jurisdiction });
});

const updateSchema = z.object({
  role: z.enum(["CITIZEN", "OFFICER", "AUTHORITY", "ADMIN"]).optional(),
  jurisdiction: z.string().optional().nullable(),
});

// PATCH /api/admin/users/:id — change role / jurisdiction
adminRouter.patch("/users/:id", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const before = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "User not found" });

  const role = parsed.data.role ?? before.role;
  const juris = role === "OFFICER" || role === "AUTHORITY"
    ? (parsed.data.jurisdiction ?? before.jurisdiction ?? null)
    : null;

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { role, jurisdiction: juris },
    select: { id: true, name: true, email: true, role: true, jurisdiction: true },
  });
  await writeAudit({
    actorId: req.user!.userId, action: "USER_UPDATE", entity: "User", entityId: updated.id,
    before: { role: before.role, jurisdiction: before.jurisdiction },
    after: { role: updated.role, jurisdiction: updated.jurisdiction },
  });
  res.json(updated);
});
