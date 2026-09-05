import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  submissionsTable,
  transactionsTable,
  usersTable,
  withdrawalsTable,
} from "@workspace/db";
import {
  CreateWithdrawalBody,
  CreateWithdrawalResponse,
  GetReferralSummaryResponse,
  GetWalletSummaryResponse,
  ListTransactionsResponse,
  ListWithdrawalsResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { iso, money, requiredIso } from "../lib/format";

const router: IRouter = Router();

router.get("/wallet/summary", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, user.id));
  const pendingSubmissions = await db
    .select()
    .from(submissionsTable)
    .where(and(eq(submissionsTable.workerId, user.id), eq(submissionsTable.status, "pending")));
  const withdrawals = transactions
    .filter((transaction) => transaction.type === "withdrawal")
    .reduce((sum, transaction) => sum + money(transaction.amount), 0);
  res.json(
    GetWalletSummaryResponse.parse({
      availableBalance: money(user.balance),
      pendingBalance: pendingSubmissions.reduce((sum, submission) => sum + money(submission.reward) * 0.4, 0),
      totalEarned: transactions
        .filter((transaction) => transaction.type === "task_reward" || transaction.type === "referral_reward")
        .reduce((sum, transaction) => sum + money(transaction.amount), 0),
      totalSpent: transactions
        .filter((transaction) => transaction.type === "task_funding")
        .reduce((sum, transaction) => sum + money(transaction.amount), 0),
      referralEarned: transactions
        .filter((transaction) => transaction.type === "referral_reward")
        .reduce((sum, transaction) => sum + money(transaction.amount), 0),
      withdrawals: Math.abs(withdrawals),
    }),
  );
});

router.get("/wallet/transactions", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, authReq.userId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(50);
  res.json(
    ListTransactionsResponse.parse(
      rows.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        description: transaction.description,
        amount: money(transaction.amount),
        status: transaction.status,
        taskId: transaction.taskId,
        createdAt: requiredIso(transaction.createdAt),
      })),
    ),
  );
});

router.get("/referrals/summary", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const [referrals, referralTransactions] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.referredBy, user.id)),
    db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, user.id), eq(transactionsTable.type, "referral_reward")))
      .orderBy(desc(transactionsTable.createdAt)),
  ]);
  res.json(
    GetReferralSummaryResponse.parse({
      referralCode: user.referralCode,
      referralLink: `https://lightjob.app/sign-up?ref=${encodeURIComponent(user.referralCode)}`,
      directReferrals: referrals.length,
      referralEarnings: referralTransactions.reduce((sum, transaction) => sum + money(transaction.amount), 0),
      recentReferrals: referrals.slice(0, 6).map((referral) => ({
        id: referral.id,
        name: referral.name,
        joinedAt: requiredIso(referral.createdAt),
        earned: referralTransactions
          .filter((transaction) => transaction.description.includes(referral.name))
          .reduce((sum, transaction) => sum + money(transaction.amount), 0),
      })),
    }),
  );
});

router.get("/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const rows = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, authReq.userId))
    .orderBy(desc(withdrawalsTable.requestedAt));
  res.json(
    ListWithdrawalsResponse.parse(
      rows.map((withdrawal) => ({
        id: withdrawal.id,
        amount: money(withdrawal.amount),
        method: withdrawal.method,
        accountLabel: withdrawal.accountLabel,
        status: withdrawal.status,
        note: withdrawal.note,
        requestedAt: requiredIso(withdrawal.requestedAt),
        processedAt: iso(withdrawal.processedAt),
      })),
    ),
  );
});

router.post("/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const parsed = CreateWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = authReq.user;
  if (!user || money(user.balance) < parsed.data.amount) {
    res.status(400).json({ error: "Insufficient available balance" });
    return;
  }
  const created = await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ balance: sql`${usersTable.balance} - ${parsed.data.amount.toFixed(2)}` })
      .where(eq(usersTable.id, authReq.userId));
    const [withdrawal] = await tx
      .insert(withdrawalsTable)
      .values({
        id: `withdrawal-${crypto.randomUUID()}`,
        userId: authReq.userId,
        amount: parsed.data.amount.toFixed(2),
        method: parsed.data.method,
        accountLabel: parsed.data.accountLabel,
      })
      .returning();
    await tx.insert(transactionsTable).values({
      id: `transaction-${crypto.randomUUID()}`,
      userId: authReq.userId,
      type: "withdrawal",
      description: `Withdrawal request via ${parsed.data.method.replace("_", " ")}`,
      amount: (-parsed.data.amount).toFixed(2),
      status: "pending",
    });
    return withdrawal;
  });
  res.status(201).json(
    CreateWithdrawalResponse.parse({
      id: created.id,
      amount: money(created.amount),
      method: created.method,
      accountLabel: created.accountLabel,
      status: created.status,
      note: created.note,
      requestedAt: requiredIso(created.requestedAt),
      processedAt: iso(created.processedAt),
    }),
  );
});

export default router;