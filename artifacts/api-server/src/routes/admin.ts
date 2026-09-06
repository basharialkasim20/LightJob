import { Router, type IRouter } from "express";
import { and, count, desc, eq, sql } from "drizzle-orm";
import {
  db,
  depositsTable,
  submissionsTable,
  tasksTable,
  transactionsTable,
  usersTable,
  withdrawalsTable,
} from "@workspace/db";
import {
  GetAdminOverviewResponse,
  ListAdminDepositsResponse,
  ListAdminUsersResponse,
  ListAdminWithdrawalsResponse,
  ReviewWithdrawalBody,
  ReviewWithdrawalParams,
  ReviewWithdrawalResponse,
  ReviewDepositBody,
  ReviewDepositParams,
  ReviewDepositResponse,
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
    depositReference: user.depositReference ?? `LJ-${user.id.slice(-8).toUpperCase()}`,
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

async function adminDepositOutput(deposit: typeof depositsTable.$inferSelect) {
  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, deposit.userId))
    .limit(1);
  return {
    id: deposit.id,
    amount: money(deposit.amount),
    bankName: deposit.bankName,
    transferReference: deposit.transferReference,
    depositReference: deposit.depositReference,
    transferredAt: requiredIso(deposit.transferredAt),
    proofUrl: deposit.proofUrl,
    status: deposit.status,
    note: deposit.note,
    createdAt: requiredIso(deposit.createdAt),
    reviewedAt: iso(deposit.reviewedAt),
    userId: deposit.userId,
    userName: user?.name ?? "LightJob member",
    userEmail: user?.email ?? "",
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
        .where(eq(transactionsTable.type, "platform_reward")),
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

router.get("/admin/deposits", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(depositsTable)
    .orderBy(desc(depositsTable.createdAt))
    .limit(100);
  res.json(ListAdminDepositsResponse.parse(await Promise.all(rows.map(adminDepositOutput))));
});

router.post("/admin/deposits/:depositId/review", requireAdmin, async (req, res): Promise<void> => {
  const params = ReviewDepositParams.safeParse(req.params);
  const body = ReviewDepositBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const message = !params.success ? params.error.message : !body.success ? body.error.message : "Invalid request";
    res.status(400).json({ error: message });
    return;
  }
  const [deposit] = await db
    .select()
    .from(depositsTable)
    .where(eq(depositsTable.id, params.data.depositId))
    .limit(1);
  if (!deposit) {
    res.status(404).json({ error: "Deposit not found" });
    return;
  }
  if (deposit.status !== "pending") {
    res.status(400).json({ error: "Deposit has already been reviewed" });
    return;
  }
  const reviewed = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(depositsTable)
      .set({
        status: body.data.decision,
        note: body.data.note ?? null,
        reviewedAt: new Date(),
      })
      .where(and(eq(depositsTable.id, deposit.id), eq(depositsTable.status, "pending")))
      .returning();
    if (!updated) {
      const error = new Error("Deposit has already been reviewed");
      (error as Error & { statusCode?: number }).statusCode = 409;
      throw error;
    }
    if (body.data.decision === "approved") {
      await tx
        .update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${deposit.amount}` })
        .where(eq(usersTable.id, deposit.userId));
      await tx.insert(transactionsTable).values({
        id: `transaction-${crypto.randomUUID()}`,
        userId: deposit.userId,
        type: "deposit",
        description: `Verified bank deposit ${deposit.transferReference}`,
        amount: deposit.amount,
        status: "completed",
      });
    }
    return updated;
  });
  res.json(ReviewDepositResponse.parse(await adminDepositOutput(reviewed)));
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