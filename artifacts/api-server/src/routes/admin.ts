import { Router, type IRouter } from "express";
import { count, desc, eq, sql } from "drizzle-orm";
import {
  db,
  submissionsTable,
  tasksTable,
  transactionsTable,
  usersTable,
  withdrawalsTable,
} from "@workspace/db";
import {
  GetAdminOverviewResponse,
  ListAdminUsersResponse,
  ListAdminWithdrawalsResponse,
  ReviewWithdrawalBody,
  ReviewWithdrawalParams,
  ReviewWithdrawalResponse,
  RoleUpdateInput,
  UpdateUserRoleBody,
  UpdateUserRoleParams,
  UpdateUserRoleResponse,
} from "@workspace/api-zod";
import { requireAdmin, requireSuperAdmin, type AuthenticatedRequest } from "../lib/auth";
import { iso, money, requiredIso } from "../lib/format";

const router: IRouter = Router();

function adminUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    balance: money(user.balance),
    referralCode: user.referralCode,
    referredBy: user.referredBy,
    createdAt: requiredIso(user.createdAt),
    lastActiveAt: requiredIso(user.updatedAt),
  };
}

function withdrawalOutput(withdrawal: typeof withdrawalsTable.$inferSelect) {
  return {
    id: withdrawal.id,
    amount: money(withdrawal.amount),
    method: withdrawal.method,
    accountLabel: withdrawal.accountLabel,
    status: withdrawal.status,
    note: withdrawal.note,
    requestedAt: requiredIso(withdrawal.requestedAt),
    processedAt: iso(withdrawal.processedAt),
  };
}

router.get("/admin/overview", requireAdmin, async (_req, res): Promise<void> => {
  const [[totalUsers], [activeTasks], [pendingSubmissions], [pendingWithdrawals], [volume], [revenue]] =
    await Promise.all([
      db.select({ value: count() }).from(usersTable),
      db.select({ value: count() }).from(tasksTable).where(eq(tasksTable.status, "open")),
      db.select({ value: count() }).from(submissionsTable).where(eq(submissionsTable.status, "pending")),
      db.select({ value: count() }).from(withdrawalsTable).where(eq(withdrawalsTable.status, "pending")),
      db.select({ value: sql<string>`coalesce(sum(${tasksTable.totalBudget}), 0)` }).from(tasksTable),
      db
        .select({ value: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
        .from(transactionsTable)
        .where(eq(transactionsTable.type, "referral_reward")),
    ]);
  res.json(
    GetAdminOverviewResponse.parse({
      totalUsers: Number(totalUsers.value),
      activeTasks: Number(activeTasks.value),
      pendingSubmissions: Number(pendingSubmissions.value),
      pendingWithdrawals: Number(pendingWithdrawals.value),
      totalVolume: money(volume.value),
      platformRevenue: money(revenue.value),
      payoutSplit: { owner: 40, worker: 40, referrer: 20 },
    }),
  );
});

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(100);
  res.json(ListAdminUsersResponse.parse(rows.map(adminUser)));
});

router.patch("/admin/users/:userId/role", requireSuperAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserRoleParams.safeParse(req.params);
  const body = UpdateUserRoleBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const message = !params.success ? params.error.message : !body.success ? body.error.message : "Invalid request";
    res.status(400).json({ error: message });
    return;
  }
  if (params.data.userId === (req as AuthenticatedRequest).userId) {
    res.status(400).json({ error: "You cannot change your own super admin permission" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ role: body.data.role })
    .where(eq(usersTable.id, params.data.userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(UpdateUserRoleResponse.parse(adminUser(updated)));
});

router.get("/admin/withdrawals", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "pending"))
    .orderBy(desc(withdrawalsTable.requestedAt));
  res.json(ListAdminWithdrawalsResponse.parse(rows.map(withdrawalOutput)));
});

router.post("/admin/withdrawals/:withdrawalId/review", requireAdmin, async (req, res): Promise<void> => {
  const params = ReviewWithdrawalParams.safeParse(req.params);
  const body = ReviewWithdrawalBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const message = !params.success ? params.error.message : !body.success ? body.error.message : "Invalid request";
    res.status(400).json({ error: message });
    return;
  }
  const [withdrawal] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.id, params.data.withdrawalId))
    .limit(1);
  if (!withdrawal) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }
  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: "Withdrawal has already been reviewed" });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    if (body.data.decision === "rejected") {
      await tx
        .update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${withdrawal.amount}` })
        .where(eq(usersTable.id, withdrawal.userId));
      await tx.insert(transactionsTable).values({
        id: `transaction-${crypto.randomUUID()}`,
        userId: withdrawal.userId,
        type: "refund",
        description: `Refund for rejected withdrawal ${withdrawal.id}`,
        amount: withdrawal.amount,
        status: "completed",
      });
    }
    const [reviewed] = await tx
      .update(withdrawalsTable)
      .set({
        status: body.data.decision,
        note: body.data.note ?? null,
        processedAt: new Date(),
      })
      .where(eq(withdrawalsTable.id, withdrawal.id))
      .returning();
    return reviewed;
  });
  res.json(ReviewWithdrawalResponse.parse(withdrawalOutput(updated)));
});

export default router;