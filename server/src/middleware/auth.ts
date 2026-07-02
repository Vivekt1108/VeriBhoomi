// Security middleware — enforced on the BACKEND, not just hidden in the UI.
// This is the heart of "least privilege": a request only proceeds if the token
// is valid AND the user's role/jurisdiction allows the action.
import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "../lib/auth.js";

// attach the logged-in user to the request so handlers can read it
export interface AuthedRequest extends Request {
  user?: TokenPayload;
}

// 1) Authentication — "are you logged in?"
export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// 2) Authorization — "is your role allowed here?"
export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Your role cannot perform this action" });
    }
    next();
  };
}

// 3) Jurisdiction guard — officers/authorities act only in their own district.
// Admins are exempt (they manage the system, not records). Pass a function that
// extracts the record's district from the request.
export function requireJurisdiction(getDistrict: (req: AuthedRequest) => Promise<string | null>) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (req.user.role === "ADMIN" || req.user.role === "CITIZEN") return next();

    const district = await getDistrict(req);
    if (district && req.user.jurisdiction && district !== req.user.jurisdiction) {
      return res.status(403).json({ error: "Outside your jurisdiction" });
    }
    next();
  };
}
