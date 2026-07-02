// Seed script — fills the database with realistic sample data so the app is
// demoable end-to-end.
//
// Four "deep" properties carry the full fraud scenarios:
//   1. Whitefield  — CLEAN (score 100)
//   2. Koramangala — double-sold + area mismatch (HIGH risk)
//   3. Indiranagar — hidden active lien + active litigation (HIGH risk)
//   4. Jayanagar   — inheritance conflict + circular ownership (MEDIUM/HIGH)
// Plus several "lighter" properties so the map and dashboards have density,
// and a handful of citizen verification requests so the case queue is alive.
// Also seeds one user per role. Run with: npm run seed
import { PrismaClient, type DocumentType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { putObject } from "../src/lib/storage.js";
import { makePdf } from "./samplePdf.js";

const prisma = new PrismaClient();
const d = (s: string) => new Date(s);

// Human label per document type, used to title the generated sample PDF.
const DOC_TITLE: Record<string, string> = {
  SALE_DEED: "SALE DEED", MUTATION: "MUTATION / KHATA EXTRACT",
  TAX_RECEIPT: "PROPERTY TAX RECEIPT", ENCUMBRANCE_CERT: "ENCUMBRANCE CERTIFICATE",
  GOVT_APPROVAL: "GOVERNMENT APPROVAL",
};

// Create a Document AND generate + store a believable one-page PDF scan for it,
// so the citizen/officer dossier has a real file to open. Returns the document.
async function seedDocWithFile(opts: {
  propertyId: string; type: DocumentType; surveyNo: string;
  extractedFields: Record<string, unknown>; ocrConfidence: number;
  uploadedById: string;
}) {
  const lines = [
    `Survey No: ${opts.surveyNo}`,
    ...Object.entries(opts.extractedFields).map(([k, v]) => `${k}: ${v}`),
    "",
    "— Sample document generated for the VeriBhoomi demo —",
  ];
  const pdf = makePdf(DOC_TITLE[opts.type] ?? opts.type, lines);
  const fileName = `${opts.type.toLowerCase()}-${opts.surveyNo.replace(/\W+/g, "_")}.pdf`;
  const key = `properties/${opts.propertyId}/${fileName}`;
  await putObject(key, pdf, "application/pdf");
  return prisma.document.create({
    data: {
      propertyId: opts.propertyId, type: opts.type,
      storageKey: key, fileName, mimeType: "application/pdf", fileSize: pdf.length,
      extractedFields: opts.extractedFields, ocrConfidence: opts.ocrConfidence,
      status: "OFFICIAL", uploadedById: opts.uploadedById,
    },
  });
}

async function main() {
  console.log("Clearing existing data...");
  // delete in dependency order
  await prisma.verificationRequest.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.healthScore.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.disputeParty.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.encumbrance.deleteMany();
  await prisma.govtApproval.deleteMany();
  await prisma.taxRecord.deleteMany();
  await prisma.inheritanceRecord.deleteMany();
  await prisma.ownershipRecord.deleteMany();
  await prisma.document.deleteMany();
  await prisma.party.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();

  // ---------- USERS (one per role) ----------
  console.log("Seeding users...");
  const pw = await bcrypt.hash("password123", 10);
  const citizen = await prisma.user.create({
    data: { email: "citizen@demo.in", passwordHash: pw, name: "Ravi Kumar", role: "CITIZEN" },
  });
  const citizen2 = await prisma.user.create({
    data: { email: "priya@demo.in", passwordHash: pw, name: "Priya Sharma", role: "CITIZEN" },
  });
  const officer = await prisma.user.create({
    data: { email: "officer@demo.in", passwordHash: pw, name: "Meena Iyer", role: "OFFICER", jurisdiction: "Bengaluru Urban" },
  });
  await prisma.user.create({
    data: { email: "officer.rural@demo.in", passwordHash: pw, name: "Suresh Gowda", role: "OFFICER", jurisdiction: "Bengaluru Rural" },
  });
  await prisma.user.create({
    data: { email: "authority@demo.in", passwordHash: pw, name: "K. Rao", role: "AUTHORITY", jurisdiction: "Bengaluru Urban" },
  });
  await prisma.user.create({
    data: { email: "admin@demo.in", passwordHash: pw, name: "Admin Singh", role: "ADMIN" },
  });

  // ---------- PARTIES ----------
  console.log("Seeding parties...");
  const parties = await Promise.all(
    [
      "Asha Nair", "Bhavna Reddy", "Chetan Gupta", "Deepa Iyer",
      "Esha Khan", "Farhan Ali", "Gita Rao", "Harish Menon",
      "Imran Sheikh", "Jaya Pillai", "Kiran Desai", "Lata Bose",
      "Manoj Verma", "Nisha Patel",
      "State Bank of Mysore", "HDFC Bank", "Canara Bank",
    ].map((name, i) =>
      prisma.party.create({
        data: { name, type: i >= 14 ? "ORG" : "PERSON" },
      }),
    ),
  );
  const P = (name: string) => parties.find((p) => p.name === name)!.id;

  // ============================================================
  // PROPERTY 1 — WHITEFIELD — CLEAN
  // ============================================================
  console.log("Property 1: Whitefield (clean)...");
  const p1 = await prisma.property.create({
    data: {
      surveyNo: "SY-147/WF", khataNo: "KH-147", area: 2400,
      district: "Bengaluru Urban", taluk: "Bengaluru East", village: "Whitefield",
      lat: 12.9698, lng: 77.7499, status: "CLEAR",
    },
  });
  await prisma.ownershipRecord.create({
    data: { propertyId: p1.id, ownerId: P("Asha Nair"), fromDate: d("2012-03-01"), toDate: null },
  });
  await seedDocWithFile({
    propertyId: p1.id, type: "SALE_DEED", surveyNo: "SY-147/WF", uploadedById: officer.id,
    extractedFields: { area: 2400, ownerName: "Asha Nair", titleStatus: "Clear" }, ocrConfidence: 0.97,
  });
  await seedDocWithFile({
    propertyId: p1.id, type: "TAX_RECEIPT", surveyNo: "SY-147/WF", uploadedById: officer.id,
    extractedFields: { area: 2400, payerName: "Asha Nair", year: 2023, status: "PAID" }, ocrConfidence: 0.96,
  });
  await prisma.taxRecord.create({
    data: { propertyId: p1.id, payerId: P("Asha Nair"), year: 2023, amount: 18000, status: "PAID" },
  });
  await prisma.govtApproval.create({
    data: { propertyId: p1.id, authority: "BBMP", level: "MUNICIPAL", status: "APPROVED" },
  });

  // ============================================================
  // PROPERTY 2 — KORAMANGALA — DOUBLE-SOLD + AREA MISMATCH
  // ============================================================
  console.log("Property 2: Koramangala (double-sold)...");
  const p2 = await prisma.property.create({
    data: {
      surveyNo: "SY-89/KOR", khataNo: "KH-89", area: 1800,
      district: "Bengaluru Urban", taluk: "Bengaluru South", village: "Koramangala",
      lat: 12.9352, lng: 77.6245, status: "FLAGGED",
    },
  });
  // two overlapping owners => double-selling
  await prisma.ownershipRecord.create({
    data: { propertyId: p2.id, ownerId: P("Bhavna Reddy"), fromDate: d("2016-01-01"), toDate: d("2021-01-01") },
  });
  await prisma.ownershipRecord.create({
    data: { propertyId: p2.id, ownerId: P("Chetan Gupta"), fromDate: d("2019-06-01"), toDate: null },
  });
  // two documents that DISAGREE on the plot area => visible contradiction
  // (sale deed says 1800, mutation says 1500). This is the project's core thesis.
  await seedDocWithFile({
    propertyId: p2.id, type: "SALE_DEED", surveyNo: "SY-89/KOR", uploadedById: officer.id,
    extractedFields: { area: 1800, ownerName: "Chetan Gupta", titleStatus: "Clear" }, ocrConfidence: 0.9,
  });
  await seedDocWithFile({
    propertyId: p2.id, type: "MUTATION", surveyNo: "SY-89/KOR", uploadedById: officer.id,
    extractedFields: { area: 1500, ownerName: "Chetan Gupta" }, ocrConfidence: 0.82,
  });

  // ============================================================
  // PROPERTY 3 — INDIRANAGAR — HIDDEN LIEN + ACTIVE LITIGATION
  // ============================================================
  console.log("Property 3: Indiranagar (lien + litigation)...");
  const p3 = await prisma.property.create({
    data: {
      surveyNo: "SY-56/IND", khataNo: "KH-56", area: 3000,
      district: "Bengaluru Urban", taluk: "Bengaluru East", village: "Indiranagar",
      lat: 12.9719, lng: 77.6412, status: "DISPUTED",
    },
  });
  await prisma.ownershipRecord.create({
    data: { propertyId: p3.id, ownerId: P("Deepa Iyer"), fromDate: d("2014-05-01"), toDate: null },
  });
  // sale deed claims clear title...
  await seedDocWithFile({
    propertyId: p3.id, type: "SALE_DEED", surveyNo: "SY-56/IND", uploadedById: officer.id,
    extractedFields: { area: 3000, ownerName: "Deepa Iyer", titleStatus: "Clear" }, ocrConfidence: 0.91,
  });
  // ...but the encumbrance certificate reveals a registered loan => hidden lien
  await seedDocWithFile({
    propertyId: p3.id, type: "ENCUMBRANCE_CERT", surveyNo: "SY-56/IND", uploadedById: officer.id,
    extractedFields: { lender: "HDFC Bank", amount: 2500000, status: "ACTIVE" }, ocrConfidence: 0.88,
  });
  // ...but an active lien exists => hidden lien (CRITICAL)
  await prisma.encumbrance.create({
    data: { propertyId: p3.id, lenderId: P("HDFC Bank"), amount: 2500000, active: true },
  });
  // and an open court case
  const dispute = await prisma.dispute.create({
    data: {
      propertyId: p3.id, court: "City Civil Court, Bengaluru", caseNo: "OS/452/2022",
      status: "OPEN", filedDate: d("2022-08-15"),
    },
  });
  await prisma.disputeParty.createMany({
    data: [
      { disputeId: dispute.id, partyId: P("Deepa Iyer"), role: "DEFENDANT" },
      { disputeId: dispute.id, partyId: P("Esha Khan"), role: "PLAINTIFF" },
    ],
  });

  // ============================================================
  // PROPERTY 4 — JAYANAGAR — INHERITANCE CONFLICT + CIRCULAR
  // ============================================================
  console.log("Property 4: Jayanagar (inheritance + circular)...");
  const p4 = await prisma.property.create({
    data: {
      surveyNo: "SY-203/JAY", khataNo: "KH-203", area: 2000,
      district: "Bengaluru Urban", taluk: "Bengaluru South", village: "Jayanagar",
      lat: 12.9250, lng: 77.5938, status: "UNDER_REVIEW",
    },
  });
  // inheritance passes to Gita Rao...
  await prisma.inheritanceRecord.create({
    data: { propertyId: p4.id, fromId: P("Farhan Ali"), toId: P("Gita Rao"), basis: "Will", date: d("2018-02-01") },
  });
  // ...but Harish Menon takes ownership soon after => inheritance conflict
  // also A -> B -> A circular pattern (Harish -> Gita -> Harish)
  await prisma.ownershipRecord.create({
    data: { propertyId: p4.id, ownerId: P("Harish Menon"), fromDate: d("2018-06-01"), toDate: d("2020-01-01") },
  });
  await prisma.ownershipRecord.create({
    data: { propertyId: p4.id, ownerId: P("Gita Rao"), fromDate: d("2020-01-01"), toDate: d("2022-01-01") },
  });
  await prisma.ownershipRecord.create({
    data: { propertyId: p4.id, ownerId: P("Harish Menon"), fromDate: d("2022-01-01"), toDate: null },
  });

  // ============================================================
  // LIGHTER PROPERTIES — give the map & dashboards density.
  // Each gets one owner, a tax record and an approval. A couple carry a
  // small encumbrance or pending approval so not everything is spotless.
  // Two sit in Bengaluru Rural to prove jurisdiction scoping is real.
  // ============================================================
  console.log("Seeding lighter properties...");
  const lighter: {
    surveyNo: string; khataNo: string; area: number; taluk: string; village: string;
    district?: string; lat: number; lng: number; status: "CLEAR" | "UNDER_REVIEW" | "DISPUTED" | "FLAGGED";
    owner: string; lien?: { lender: string; amount: number; active: boolean };
    approval?: "APPROVED" | "PENDING";
  }[] = [
    { surveyNo: "SY-310/HSR", khataNo: "KH-310", area: 1600, taluk: "Bengaluru South", village: "HSR Layout", lat: 12.9116, lng: 77.6473, status: "CLEAR", owner: "Imran Sheikh" },
    { surveyNo: "SY-088/MAR", khataNo: "KH-088", area: 2200, taluk: "Bengaluru East", village: "Marathahalli", lat: 12.9591, lng: 77.6974, status: "CLEAR", owner: "Jaya Pillai" },
    { surveyNo: "SY-512/HEB", khataNo: "KH-512", area: 4000, taluk: "Bengaluru North", village: "Hebbal", lat: 13.0358, lng: 77.5970, status: "UNDER_REVIEW", owner: "Kiran Desai", approval: "PENDING" },
    { surveyNo: "SY-067/BAN", khataNo: "KH-067", area: 1500, taluk: "Bengaluru South", village: "Banashankari", lat: 12.9255, lng: 77.5468, status: "CLEAR", owner: "Lata Bose" },
    { surveyNo: "SY-204/MAL", khataNo: "KH-204", area: 2600, taluk: "Bengaluru North", village: "Malleshwaram", lat: 13.0035, lng: 77.5709, status: "UNDER_REVIEW", owner: "Manoj Verma", lien: { lender: "Canara Bank", amount: 1200000, active: true } },
    { surveyNo: "SY-401/JPN", khataNo: "KH-401", area: 1900, taluk: "Bengaluru South", village: "JP Nagar", lat: 12.9101, lng: 77.5855, status: "CLEAR", owner: "Nisha Patel" },
    // --- Bengaluru Rural: outside the Urban officer's jurisdiction ---
    { surveyNo: "SY-720/YEL", khataNo: "KH-720", area: 5200, taluk: "Yelahanka", village: "Yelahanka", district: "Bengaluru Rural", lat: 13.1007, lng: 77.5963, status: "UNDER_REVIEW", owner: "Kiran Desai", approval: "PENDING" },
    { surveyNo: "SY-905/DEV", khataNo: "KH-905", area: 8000, taluk: "Devanahalli", village: "Devanahalli", district: "Bengaluru Rural", lat: 13.2437, lng: 77.7126, status: "FLAGGED", owner: "Manoj Verma", lien: { lender: "State Bank of Mysore", amount: 4500000, active: true } },
  ];

  const lightProps = [];
  for (const l of lighter) {
    const prop = await prisma.property.create({
      data: {
        surveyNo: l.surveyNo, khataNo: l.khataNo, area: l.area,
        district: l.district ?? "Bengaluru Urban", taluk: l.taluk, village: l.village,
        lat: l.lat, lng: l.lng, status: l.status,
      },
    });
    await prisma.ownershipRecord.create({
      data: { propertyId: prop.id, ownerId: P(l.owner), fromDate: d("2015-04-01"), toDate: null },
    });
    await seedDocWithFile({
      propertyId: prop.id, type: "SALE_DEED", surveyNo: l.surveyNo, uploadedById: officer.id,
      extractedFields: { area: l.area, ownerName: l.owner, titleStatus: "Clear" }, ocrConfidence: 0.9,
    });
    await prisma.taxRecord.create({
      data: { propertyId: prop.id, payerId: P(l.owner), year: 2023, amount: Math.round(l.area * 8), status: "PAID" },
    });
    await prisma.govtApproval.create({
      data: { propertyId: prop.id, authority: "BBMP", level: "MUNICIPAL", status: l.approval ?? "APPROVED" },
    });
    if (l.lien) {
      await prisma.encumbrance.create({
        data: { propertyId: prop.id, lenderId: P(l.lien.lender), amount: l.lien.amount, active: l.lien.active },
      });
    }
    lightProps.push(prop);
  }

  // ============================================================
  // VERIFICATION REQUESTS — the citizen→officer case files.
  // A mix of statuses so the officer queue and citizen tracker both look alive.
  // ============================================================
  console.log("Seeding verification requests...");
  await prisma.verificationRequest.createMany({
    data: [
      // Ravi is mid-purchase of the double-sold Koramangala plot — the scary one.
      { propertyId: p2.id, requesterId: citizen.id, purpose: "PURCHASE", note: "Builder is pushing me to pay advance this week. Please verify urgently.", status: "SUBMITTED" },
      // Ravi also checked a clean one earlier — already cleared.
      { propertyId: p1.id, requesterId: citizen.id, purpose: "PURCHASE", note: "Resale flat in Whitefield.", status: "CLEARED", officerId: officer.id, officerNote: "Title clear, taxes paid, no encumbrance. Safe to proceed." },
      // Ravi's loan check on Indiranagar — officer picked it up, found problems.
      { propertyId: p3.id, requesterId: citizen.id, purpose: "LOAN", note: "Bank asked for title verification before sanction.", status: "FLAGGED", officerId: officer.id, officerNote: "Active HDFC lien of ₹25L and an open court case (OS/452/2022). Do NOT proceed without clearing both." },
      // Priya, settling her father's estate in Jayanagar — under review now.
      { propertyId: p4.id, requesterId: citizen2.id, purpose: "INHERITANCE", note: "My father's property, settling among siblings.", status: "IN_REVIEW", officerId: officer.id },
      // Priya also browsing an HSR plot — fresh submission.
      { propertyId: lightProps[0].id, requesterId: citizen2.id, purpose: "GENERAL", note: "Just exploring options in HSR.", status: "SUBMITTED" },
    ],
  });

  console.log("\nSeed complete!");
  console.log("Login with password: password123");
  console.log("  citizen@demo.in / priya@demo.in / officer@demo.in / authority@demo.in / admin@demo.in");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
