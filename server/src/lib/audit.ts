// Append-only audit logging. Every sensitive view/edit calls this so we can
// always prove who did what, when, and what changed. Land records are
// sensitive — this trail is non-negotiable.
import { prisma } from "./prisma.js";

export async function writeAudit(params: {
  actorId: string;
  action: string; // VIEW / CREATE / UPDATE / VERIFY / OVERRIDE
  entity: string; // "Finding", "Property", ...
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before === undefined ? undefined : (params.before as object),
        after: params.after === undefined ? undefined : (params.after as object),
      },
    });
  } catch (e) {
    // never let an audit failure break the main request, but do surface it
    console.error("Audit log write failed:", e);
  }
}
