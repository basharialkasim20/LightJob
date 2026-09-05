import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

export type AuthenticatedRequest = Request & { userId: string; user?: User };

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function clerkUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth.userId ?? null;
}

export async function ensureUser(req: Request): Promise<User | null> {
  const userId = clerkUserId(req);
  if (!userId) return null;

  const existing = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (existing[0]) return existing[0];

  const auth = getAuth(req);
  const claims = (auth?.sessionClaims ?? {}) as Record<string, unknown>;
  const email = asString(claims.email) ?? `${userId}@lightjob.local`;
  const name =
    asString(claims.name) ??
    [asString(claims.firstName), asString(claims.lastName)].filter(Boolean).join(" ") ??
    "LightJob member";
  const avatarUrl = asString(claims.imageUrl);
  const nonSeedUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(ne(usersTable.id, "seed-advertiser"))
    .limit(1);
  const role = nonSeedUsers.length === 0 ? "super_admin" : "worker";

  const inserted = await db
    .insert(usersTable)
    .values({
      id: userId,
      name,
      email,
      avatarUrl,
      role,
      referralCode: `LJ-${userId.slice(-8).toUpperCase()}`,
    })
    .returning();
  return inserted[0] ?? null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await ensureUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const authReq = req as AuthenticatedRequest;
  authReq.userId = user.id;
  authReq.user = user;
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await ensureUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (user.role !== "admin" && user.role !== "super_admin") {
    res.status(403).json({ error: "Admin permission required" });
    return;
  }
  const authReq = req as AuthenticatedRequest;
  authReq.userId = user.id;
  authReq.user = user;
  next();
}

export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await ensureUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (user.role !== "super_admin") {
    res.status(403).json({ error: "Super admin permission required" });
    return;
  }
  const authReq = req as AuthenticatedRequest;
  authReq.userId = user.id;
  authReq.user = user;
  next();
}