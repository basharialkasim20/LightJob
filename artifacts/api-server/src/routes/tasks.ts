import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  db,
  submissionsTable,
  tasksTable,
  transactionsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateTaskBody,
  CreateTaskResponse,
  GetTaskParams,
  GetTaskResponse,
  ListSubmissionsQueryParams,
  ListSubmissionsResponse,
  ListTasksQueryParams,
  ListTasksResponse,
  ReviewSubmissionBody,
  ReviewSubmissionParams,
  ReviewSubmissionResponse,
  SubmitTaskBody,
  SubmitTaskParams,
  SubmitTaskResponse,
} from "@workspace/api-zod";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { iso, money, requiredIso } from "../lib/format";

const router: IRouter = Router();

async function taskOutput(task: typeof tasksTable.$inferSelect) {
  const [advertiser] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, task.advertiserId))
    .limit(1);
  return {
    id: task.id,
    title: task.title,
    advertiserId: task.advertiserId,
    advertiserName: advertiser?.name ?? "LightJob advertiser",
    category: task.category,
    description: task.description,
    instructions: task.instructions,
    proofType: task.proofType,
    requiresKyc: task.requiresKyc,
    reward: money(task.reward),
    totalBudget: money(task.totalBudget),
    remainingBudget: money(task.remainingBudget),
    maxCompletions: task.maxCompletions,
    completedCount: task.completedCount,
    status: task.status,
    deadline: requiredIso(task.deadline),
    createdAt: requiredIso(task.createdAt),
  };
}

async function submissionOutput(submission: typeof submissionsTable.$inferSelect) {
  const [[task], [worker]] = await Promise.all([
    db
      .select({ title: tasksTable.title })
      .from(tasksTable)
      .where(eq(tasksTable.id, submission.taskId))
      .limit(1),
    db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, submission.workerId))
      .limit(1),
  ]);
  return {
    id: submission.id,
    taskId: submission.taskId,
    taskTitle: task?.title ?? "Task",
    workerId: submission.workerId,
    workerName: worker?.name ?? "Worker",
    proof: submission.proof,
    status: submission.status,
    reward: money(submission.reward),
    reviewerNote: submission.reviewerNote,
    submittedAt: requiredIso(submission.submittedAt),
    reviewedAt: iso(submission.reviewedAt),
  };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, category, status, page, limit } = parsed.data;
  const filters = [];
  if (status !== "all") filters.push(eq(tasksTable.status, status));
  if (category) filters.push(eq(tasksTable.category, category));
  if (search) {
    filters.push(or(ilike(tasksTable.title, `%${search}%`), ilike(tasksTable.description, `%${search}%`)));
  }
  const rows = await db
    .select()
    .from(tasksTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(tasksTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(tasksTable)
    .where(filters.length ? and(...filters) : undefined);
  res.json(
    ListTasksResponse.parse({
      items: await Promise.all(rows.map(taskOutput)),
      page,
      limit,
      total: Number(total),
    }),
  );
});

router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  if (!user || !["advertiser", "admin", "super_admin"].includes(user.role)) {
    res.status(403).json({ error: "Advertiser permission required" });
    return;
  }
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const reward = parsed.data.requiresKyc ? 400 : 200;
  const totalBudget = reward * parsed.data.maxCompletions;
  const task = {
    id: `task-${crypto.randomUUID()}`,
    advertiserId: user.id,
    ...parsed.data,
    requiresKyc: parsed.data.requiresKyc,
    reward: reward.toFixed(2),
    totalBudget: totalBudget.toFixed(2),
    remainingBudget: totalBudget.toFixed(2),
    maxCompletions: parsed.data.maxCompletions,
  };
  let created: typeof tasksTable.$inferSelect | undefined;
  try {
    created = await db.transaction(async (tx) => {
      const [funded] = await tx
        .update(usersTable)
        .set({ balance: sql`${usersTable.balance} - ${totalBudget.toFixed(2)}` })
        .where(and(eq(usersTable.id, user.id), sql`${usersTable.balance} >= ${totalBudget.toFixed(2)}`))
        .returning({ id: usersTable.id });
      if (!funded) {
        const error = new Error("Insufficient available balance. Deposit and approve funds before publishing this task.");
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
      }
      const [inserted] = await tx.insert(tasksTable).values(task).returning();
      await tx.insert(transactionsTable).values({
        id: `transaction-${crypto.randomUUID()}`,
        userId: user.id,
        type: "task_funding",
        description: `Reserved budget for ${task.title}`,
        amount: (-totalBudget).toFixed(2),
        status: "completed",
        taskId: task.id,
      });
      return inserted;
    });
  } catch (error) {
    if (error instanceof Error && (error as Error & { statusCode?: number }).statusCode === 400) {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
  if (!created) {
    res.status(500).json({ error: "Task could not be created" });
    return;
  }
  res.status(201).json(CreateTaskResponse.parse(await taskOutput(created)));
});

router.get("/tasks/:taskId", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.taskId)).limit(1);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(GetTaskResponse.parse(await taskOutput(task)));
});

router.post("/tasks/:taskId/submissions", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const params = SubmitTaskParams.safeParse(req.params);
  const body = SubmitTaskBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const message = !params.success ? params.error.message : !body.success ? body.error.message : "Invalid request";
    res.status(400).json({ error: message });
    return;
  }
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.taskId)).limit(1);
  if (!task || task.status !== "open" || task.remainingBudget === "0") {
    res.status(400).json({ error: "This task is not accepting submissions" });
    return;
  }
  const [submission] = await db
    .insert(submissionsTable)
    .values({
      id: `submission-${crypto.randomUUID()}`,
      taskId: task.id,
      workerId: authReq.userId,
      proof: body.data.proof,
      reward: task.reward,
    })
    .returning();
  res.status(201).json(SubmitTaskResponse.parse(await submissionOutput(submission)));
});

router.get("/submissions", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const parsed = ListSubmissionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { view, status } = parsed.data;
  const ownedTaskRows =
    view === "owned"
      ? await db.select({ id: tasksTable.id }).from(tasksTable).where(eq(tasksTable.advertiserId, authReq.userId))
      : [];
  const filters = [];
  if (view === "mine") filters.push(eq(submissionsTable.workerId, authReq.userId));
  if (view === "owned") filters.push(inArray(submissionsTable.taskId, ownedTaskRows.map((task) => task.id)));
  if (status !== "all") filters.push(eq(submissionsTable.status, status));
  const rows =
    view === "owned" && ownedTaskRows.length === 0
      ? []
      : await db
          .select()
          .from(submissionsTable)
          .where(and(...filters))
          .orderBy(desc(submissionsTable.submittedAt));
  res.json(ListSubmissionsResponse.parse(await Promise.all(rows.map(submissionOutput))));
});

router.post("/submissions/:submissionId/review", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const params = ReviewSubmissionParams.safeParse(req.params);
  const body = ReviewSubmissionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const message = !params.success ? params.error.message : !body.success ? body.error.message : "Invalid request";
    res.status(400).json({ error: message });
    return;
  }
  const [submission] = await db
    .select()
    .from(submissionsTable)
    .where(eq(submissionsTable.id, params.data.submissionId))
    .limit(1);
  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, submission.taskId)).limit(1);
  if (!task || task.advertiserId !== authReq.userId) {
    res.status(403).json({ error: "Only the task owner can review submissions" });
    return;
  }
  if (submission.status !== "pending") {
    res.status(400).json({ error: "This submission has already been reviewed" });
    return;
  }
  if (body.data.decision === "rejected") {
    const [updated] = await db
      .update(submissionsTable)
      .set({ status: "rejected", reviewerNote: body.data.reviewerNote ?? null, reviewedAt: new Date() })
      .where(eq(submissionsTable.id, submission.id))
      .returning();
    res.json(ReviewSubmissionResponse.parse(await submissionOutput(updated)));
    return;
  }

  const [platformOwner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "super_admin"))
    .orderBy(usersTable.createdAt)
    .limit(1);
  if (!platformOwner) {
    res.status(503).json({ error: "Platform owner is not configured yet" });
    return;
  }
  const rewardCents = Math.round(money(task.reward) * 100);
  const ownerShareCents = Math.round(rewardCents * 0.4);
  const workerShareCents = Math.round(rewardCents * 0.4);
  const referrerShareCents = rewardCents - ownerShareCents - workerShareCents;
  const centsToAmount = (cents: number) => (cents / 100).toFixed(2);
  const ownerShare = centsToAmount(ownerShareCents);
  const workerShare = centsToAmount(workerShareCents);
  const referrerShare = centsToAmount(referrerShareCents);
  const [worker] = await db.select().from(usersTable).where(eq(usersTable.id, submission.workerId)).limit(1);
  const referrer = worker?.referredBy
    ? (await db.select().from(usersTable).where(eq(usersTable.id, worker.referredBy)).limit(1))[0]
    : undefined;

  const updated = await db.transaction(async (tx) => {
    const [reviewed] = await tx
      .update(submissionsTable)
      .set({ status: "approved", reviewerNote: body.data.reviewerNote ?? null, reviewedAt: new Date() })
      .where(and(eq(submissionsTable.id, submission.id), eq(submissionsTable.status, "pending")))
      .returning();
    if (!reviewed) {
      const error = new Error("This submission has already been reviewed");
      (error as Error & { statusCode?: number }).statusCode = 409;
      throw error;
    }
    const [capacityUpdated] = await tx
      .update(tasksTable)
      .set({
        completedCount: sql`${tasksTable.completedCount} + 1`,
        remainingBudget: sql`${tasksTable.remainingBudget} - ${task.reward}`,
        status: sql`case when ${tasksTable.completedCount} + 1 >= ${task.maxCompletions} then 'completed' else 'open' end`,
      })
      .where(and(eq(tasksTable.id, task.id), sql`${tasksTable.completedCount} < ${task.maxCompletions}`))
      .returning({ id: tasksTable.id });
    if (!capacityUpdated) {
      const error = new Error("This task no longer has available completion capacity");
      (error as Error & { statusCode?: number }).statusCode = 409;
      throw error;
    }
    await tx
      .update(usersTable)
      .set({ balance: sql`${usersTable.balance} + ${ownerShare}` })
      .where(eq(usersTable.id, platformOwner.id));
    await tx
      .update(usersTable)
      .set({ balance: sql`${usersTable.balance} + ${workerShare}` })
      .where(eq(usersTable.id, submission.workerId));
    await tx.insert(transactionsTable).values([
      {
        id: `transaction-${crypto.randomUUID()}`,
        userId: platformOwner.id,
        type: "platform_reward",
        description: `Platform owner share for ${task.title}`,
        amount: ownerShare,
        status: "completed",
        taskId: task.id,
      },
      {
        id: `transaction-${crypto.randomUUID()}`,
        userId: submission.workerId,
        type: "task_reward",
        description: `Worker reward for ${task.title}`,
        amount: workerShare,
        status: "completed",
        taskId: task.id,
      },
    ]);
    if (referrer) {
      await tx
        .update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${referrerShare}` })
        .where(eq(usersTable.id, referrer.id));
      await tx.insert(transactionsTable).values({
        id: `transaction-${crypto.randomUUID()}`,
        userId: referrer.id,
        type: "referral_reward",
        description: `Direct referral share from ${task.title}`,
        amount: referrerShare,
        status: "completed",
        taskId: task.id,
      });
    } else {
      await tx
        .update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${referrerShare}` })
        .where(eq(usersTable.id, platformOwner.id));
      await tx.insert(transactionsTable).values({
        id: `transaction-${crypto.randomUUID()}`,
        userId: platformOwner.id,
        type: "platform_reward",
        description: `Unassigned referral share for ${task.title}`,
        amount: referrerShare,
        status: "completed",
        taskId: task.id,
      });
    }
    return reviewed;
  });
  res.json(ReviewSubmissionResponse.parse(await submissionOutput(updated)));
});

export default router;