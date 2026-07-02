// VeriBhoomi API server entry point.
import "dotenv/config";
import express from "express";
import cors from "cors";

import { authRouter } from "./routes/auth.js";
import { propertyRouter } from "./routes/property.js";
import { findingRouter } from "./routes/finding.js";
import { auditRouter } from "./routes/audit.js";
import { requestRouter } from "./routes/request.js";
import { publicRouter } from "./routes/public.js";
import { statsRouter } from "./routes/stats.js";
import { adminRouter } from "./routes/admin.js";
import { documentRouter } from "./routes/document.js";

const app = express();
app.use(cors());
app.use(express.json());

// health check
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "veribhoomi" }));

app.use("/api/auth", authRouter);
app.use("/api/properties", propertyRouter);
app.use("/api/findings", findingRouter);
app.use("/api/audit", auditRouter);
app.use("/api/requests", requestRouter);
app.use("/api/public", publicRouter);
app.use("/api/stats", statsRouter);
app.use("/api/admin", adminRouter);
app.use("/api", documentRouter); // /api/properties/:id/documents, /api/documents/:id/file

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`VeriBhoomi API running on http://localhost:${PORT}`);
});
