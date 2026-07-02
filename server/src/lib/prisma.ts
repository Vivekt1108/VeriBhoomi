// Single shared Prisma client for the whole app.
// Import this everywhere instead of creating new clients.
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
