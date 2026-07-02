// Bridges the database to the pure engine.
// Loads a property with all its relations and reshapes it into a PropertyGraph
// (the plain structure the engine understands). Keeping this separate is what
// lets the engine stay DB-free and testable.
import { prisma } from "../lib/prisma.js";
import type { PropertyGraph } from "./types.js";

export async function buildPropertyGraph(propertyId: string): Promise<PropertyGraph | null> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      ownerships: true,
      inheritances: true,
      documents: true,
      taxRecords: true,
      encumbrances: true,
      disputes: { include: { parties: true } },
    },
  });
  if (!property) return null;

  // every party referenced anywhere, for name lookups
  const partyIds = new Set<string>();
  property.ownerships.forEach((o) => partyIds.add(o.ownerId));
  property.inheritances.forEach((i) => { partyIds.add(i.fromId); partyIds.add(i.toId); });
  property.taxRecords.forEach((t) => partyIds.add(t.payerId));
  property.encumbrances.forEach((e) => partyIds.add(e.lenderId));
  property.disputes.forEach((d) => d.parties.forEach((p) => partyIds.add(p.partyId)));

  const parties = await prisma.party.findMany({
    where: { id: { in: [...partyIds] } },
    select: { id: true, name: true },
  });

  return {
    propertyId: property.id,
    surveyNo: property.surveyNo,
    area: property.area,
    parties,
    ownerships: property.ownerships.map((o) => ({
      id: o.id, ownerId: o.ownerId, fromDate: o.fromDate, toDate: o.toDate,
    })),
    inheritances: property.inheritances.map((i) => ({
      id: i.id, fromId: i.fromId, toId: i.toId, date: i.date,
    })),
    documents: property.documents.map((doc) => ({
      id: doc.id, type: doc.type,
      extractedFields: doc.extractedFields as Record<string, unknown>,
      ocrConfidence: doc.ocrConfidence,
    })),
    taxRecords: property.taxRecords.map((t) => ({
      id: t.id, payerId: t.payerId, year: t.year,
    })),
    disputes: property.disputes.map((dp) => ({
      id: dp.id, status: dp.status, caseNo: dp.caseNo, court: dp.court,
      partyIds: dp.parties.map((p) => p.partyId),
    })),
    encumbrances: property.encumbrances.map((e) => ({
      id: e.id, active: e.active, amount: e.amount,
    })),
  };
}
