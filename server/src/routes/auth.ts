// Auth routes: register and login. Returns a JWT the frontend stores and sends
// on every later request. Also self-service account routes (me / profile /
// password) so a logged-in user can see and manage their own account.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, signToken } from "../lib/auth.js";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  // public registration only ever creates citizens; staff are provisioned by admin
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password), role: "CITIZEN" },
  });
  const token = signToken({ userId: user.id, role: user.role, jurisdiction: user.jurisdiction });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken({ userId: user.id, role: user.role, jurisdiction: user.jurisdiction });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, jurisdiction: user.jurisdiction },
  });
});

// ---------- SELF-SERVICE ACCOUNT (any logged-in user) ----------

// GET /api/auth/me — the current user's own profile + a little activity summary.
authRouter.get("/me", authenticate, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true, name: true, email: true, role: true, jurisdiction: true, createdAt: true,
      _count: { select: { requestsMade: true, requestsHandled: true, verifiedFindings: true } },
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// PATCH /api/auth/profile — update your own display name. Role/jurisdiction are
// NOT self-editable: only an admin can change those (separation of duty).
const profileSchema = z.object({ name: z.string().min(1).max(120) });
authRouter.patch("/profile", authenticate, async (req: AuthedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const before = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } });
  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { name: parsed.data.name.trim() },
    select: { id: true, name: true, email: true, role: true, jurisdiction: true },
  });
  await writeAudit({
    actorId: req.user!.userId, action: "PROFILE_UPDATE", entity: "User", entityId: user.id,
    before: { name: before?.name }, after: { name: user.name },
  });
  res.json(user);
});

// POST /api/auth/password — change your own password. Must prove the current
// one first, so a stolen session alone can't lock you out.
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
authRouter.post("/password", authenticate, async (req: AuthedRequest, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  await writeAudit({ actorId: user.id, action: "PASSWORD_CHANGE", entity: "User", entityId: user.id });
  res.json({ ok: true });
});
