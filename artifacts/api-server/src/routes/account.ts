import { Router, type IRouter } from "express";
import { and, count, desc, eq, sql } from "drizzle-orm";
import {
  db,
  submissionsTable,
  tasksTable,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetMeResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { iso, money, requiredIso } from "../lib/format";

const router: IRouter = Router();

function profile(user: NonNullable<AuthenticatedRequest["user"]>) {
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
  };
}

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.json(GetMeResponse.parse(profile(user)));
});

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [activeTasks, availableTasks, completedTasks, pendingReview, transactions] =
    await Promise.all([
      db.select({ value: count() }).from(tasksTable).where(eq(tasksTable.advertiserId, user.id)),
      db.select({ value: count() }).from(tasksTable).where(eq(tasksTable.status, "open")),
      db
        .select({ value: count() })
        .from(submissionsTable)
        .where(and(eq(submissionsTable.workerId, user.id), eq(submissionsTable.status, "approved"))),
      db
        .select({ value: count() })
        .from(submissionsTable)
        .where(and(eq(submissionsTable.workerId, user.id), eq(submissionsTable.status, "pending"))),
      db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.userId, user.id))
        .orderBy(desc(transactionsTable.createdAt))
        .limit(6),
    ]);

  const earningsThisMonth = transactions
    .filter((transaction) => transaction.type === "task_reward" || transaction.type === "referral_reward")
    .reduce((sum, transaction) => sum + money(transaction.amount), 0);
  const recentActivity = transactions.slice(0, 5).map((transaction) => ({
    id: transaction.id,
    type:
      transaction.type === "referral_reward"
        ? "referral"
        : transaction.type === "withdrawal"
          ? "withdrawal"
          : transaction.type === "task_reward"
            ? "earning"
            : "task",
    title: transaction.description,
    description: transaction.status === "completed" ? "Completed" : "Pending review",
    amount: money(transaction.amount),
    timestamp: requiredIso(transaction.createdAt),
  }));
  const trendLabels = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const earningsTrend = trendLabels.map((label, index) => ({
    label,
    amount: index === trendLabels.length - 1 ? earningsThisMonth : 0,
  }));

  res.json(
    GetDashboardSummaryResponse.parse({
      profile: profile(user),
      activeTasks: Number(activeTasks[0]?.value ?? 0),
      availableTasks: Number(availableTasks[0]?.value ?? 0),
      completedTasks: Number(completedTasks[0]?.value ?? 0),
      earningsThisMonth: money(earningsThisMonth),
      pendingReview: Number(pendingReview[0]?.value ?? 0),
      referralEarnings: money(
        transactions
          .filter((transaction) => transaction.type === "referral_reward")
          .reduce((sum, transaction) => sum + money(transaction.amount), 0),
      ),
      recentActivity,
      earningsTrend,
    }),
  );
});

export default router;