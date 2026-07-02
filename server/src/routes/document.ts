// Document routes — uploading, listing and viewing the actual paper scans
// attached to a plot.
//
// WHO CAN DO WHAT (enforced here on the backend, not just the UI):
//   - Officer / Authority : upload OFFICIAL documents to the record
//                           (officers only within their own district).
//   - Citizen            : submit a PENDING supporting paper tied to one of
//                           THEIR OWN verification requests — never touches the
//                           official record.
//   - Anyone authenticated: view a file (citizens get a read-only view).
// Every upload is audited.
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";
import { putObject, getObjectAccess } from "../lib/storage.js";
import { findConflicts } from "../lib/docConflict.js";

export const documentRouter = Router();
documentRouter.use(authenticate);

// Keep uploads in memory (we hand the buffer straight to the storage adapter).
// 10 MB cap; PDFs and common image scans only.
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF or image files are allowed"));
  },
});

const DOC_TYPES = ["SALE_DEED", "MUTATION", "TAX_RECEIPT", "ENCUMBRANCE_CERT", "GOVT_APPROVAL"] as const;

// ---------- OFFICER / AUTHORITY: attach an OFFICIAL document ----------
// multipart/form-data: file + type + extractedFields(JSON string) + ocrConfidence
documentRouter.post(
  "/properties/:propertyId/documents",
  requireRole("OFFICER", "AUTHORITY"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const property = await prisma.property.findUnique({ where: { id: req.params.propertyId } });
    if (!property) return res.status(404).json({ error: "Property not found" });

    // jurisdiction guard: an officer can only add docs in their own district
    if (req.user?.role === "OFFICER" && req.user.jurisdiction && property.district !== req.user.jurisdiction) {
      return res.status(403).json({ error: "Outside your jurisdiction" });
    }

    const schema = z.object({
      type: z.enum(DOC_TYPES),
      extractedFields: z.string().optional(), // JSON string from the form
      ocrConfidence: z.coerce.number().min(0).max(1).default(1),
      // when the officer has been warned about a conflict and chooses to proceed
      overrideReason: z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    if (!req.file) return res.status(400).json({ error: "A file is required" });

    let fields: Record<string, unknown> = {};
    if (parsed.data.extractedFields) {
      try { fields = JSON.parse(parsed.data.extractedFields); }
      catch { return res.status(400).json({ error: "extractedFields must be valid JSON" }); }
    }

    // CONFLICT CHECK — compare against the existing OFFICIAL documents.
    const existing = await prisma.document.findMany({
      where: { propertyId: property.id, status: "OFFICIAL" },
      select: { type: true, extractedFields: true },
    });
    const conflicts = findConflicts(
      { type: parsed.data.type, extractedFields: fields },
      existing.map((d) => ({ type: d.type, extractedFields: (d.extractedFields ?? {}) as Record<string, unknown> })),
    );
    // If it contradicts the record and the officer hasn't justified it yet,
    // stop and report the conflict so the UI can warn + ask for a reason.
    if (conflicts.length > 0 && !parsed.data.overrideReason?.trim()) {
      return res.status(409).json({ error: "conflict", conflicts });
    }

    // store the bytes, then record the document
    const key = `properties/${property.id}/${parsed.data.type}-${req.file.originalname}`;
    const storageKey = await putObject(key, req.file.buffer, req.file.mimetype);

    const doc = await prisma.document.create({
      data: {
        propertyId: property.id,
        type: parsed.data.type,
        storageKey,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        extractedFields: fields as Prisma.InputJsonValue,
        ocrConfidence: parsed.data.ocrConfidence,
        status: "OFFICIAL",
        uploadedById: req.user!.userId,
        overrideReason: parsed.data.overrideReason?.trim() || null,
      },
    });
    await writeAudit({
      actorId: req.user!.userId, action: "DOCUMENT_UPLOAD",
      entity: "Document", entityId: doc.id,
      after: {
        type: doc.type, fileName: doc.fileName, status: "OFFICIAL",
        // record the override + what it contradicted, for the permanent trail
        ...(conflicts.length > 0 ? { overrideReason: parsed.data.overrideReason, conflicts } : {}),
      },
    });
    res.json(doc);
  },
);

// ---------- OFFICER / AUTHORITY: supersede a document (append-only replace) ----------
// The old document is NEVER deleted — it flips to SUPERSEDED and points at the
// new one. Upload the replacement, then call this to link them.
documentRouter.patch(
  "/documents/:id/supersede",
  requireRole("OFFICER", "AUTHORITY"),
  async (req: AuthedRequest, res) => {
    const schema = z.object({ replacementId: z.string().min(1), reason: z.string().max(500).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const [oldDoc, newDoc] = await Promise.all([
      prisma.document.findUnique({ where: { id: req.params.id }, include: { property: true } }),
      prisma.document.findUnique({ where: { id: parsed.data.replacementId } }),
    ]);
    if (!oldDoc || !newDoc) return res.status(404).json({ error: "Document not found" });
    if (oldDoc.propertyId !== newDoc.propertyId) {
      return res.status(400).json({ error: "Both documents must belong to the same property" });
    }
    // jurisdiction guard
    if (req.user?.role === "OFFICER" && req.user.jurisdiction && oldDoc.property.district !== req.user.jurisdiction) {
      return res.status(403).json({ error: "Outside your jurisdiction" });
    }

    const updated = await prisma.document.update({
      where: { id: oldDoc.id },
      data: { status: "SUPERSEDED", supersededById: newDoc.id, overrideReason: parsed.data.reason?.trim() || oldDoc.overrideReason },
    });
    await writeAudit({
      actorId: req.user!.userId, action: "DOCUMENT_SUPERSEDE",
      entity: "Document", entityId: oldDoc.id,
      before: { status: oldDoc.status }, after: { status: "SUPERSEDED", supersededBy: newDoc.id, reason: parsed.data.reason },
    });
    res.json(updated);
  },
);

// ---------- CITIZEN: submit a PENDING supporting paper for one's own request ----------
documentRouter.post(
  "/requests/:requestId/documents",
  requireRole("CITIZEN"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const request = await prisma.verificationRequest.findUnique({ where: { id: req.params.requestId } });
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.requesterId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your request" });
    }
    const schema = z.object({ type: z.enum(DOC_TYPES) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    if (!req.file) return res.status(400).json({ error: "A file is required" });

    const key = `pending/${request.propertyId}/${req.user!.userId}-${req.file.originalname}`;
    const storageKey = await putObject(key, req.file.buffer, req.file.mimetype);

    // attached to the property but marked PENDING — NOT part of the official record
    const doc = await prisma.document.create({
      data: {
        propertyId: request.propertyId,
        type: parsed.data.type,
        storageKey,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        extractedFields: {},
        ocrConfidence: 1,
        status: "PENDING",
        uploadedById: req.user!.userId,
      },
    });
    await writeAudit({
      actorId: req.user!.userId, action: "DOCUMENT_SUBMIT",
      entity: "Document", entityId: doc.id,
      after: { type: doc.type, fileName: doc.fileName, status: "PENDING" },
    });
    res.json(doc);
  },
);

// ---------- ANYONE AUTHENTICATED: view a file ----------
// Cloud mode → redirect to a short-lived signed URL. Local mode → stream bytes.
documentRouter.get("/documents/:id/file", async (req: AuthedRequest, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc || !doc.storageKey) return res.status(404).json({ error: "No file on record" });

  try {
    const access = await getObjectAccess(doc.storageKey);
    await writeAudit({
      actorId: req.user!.userId, action: "DOCUMENT_VIEW",
      entity: "Document", entityId: doc.id,
    });
    if (access.mode === "redirect") return res.redirect(access.url!);
    res.setHeader("Content-Type", doc.mimeType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${doc.fileName ?? "document"}"`);
    return res.send(access.body);
  } catch {
    return res.status(404).json({ error: "File could not be retrieved" });
  }
});
