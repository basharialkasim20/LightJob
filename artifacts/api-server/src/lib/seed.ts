import { eq } from "drizzle-orm";
import { db, tasksTable, usersTable } from "@workspace/db";
import { logger } from "./logger";

export async function seedLightJob(): Promise<void> {
  const existing = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(eq(tasksTable.id, "task-welcome-survey"))
    .limit(1);
  if (existing[0]) return;

  await db
    .insert(usersTable)
    .values({
      id: "seed-advertiser",
      name: "LightJob Labs",
      email: "hello@lightjob.example",
      role: "advertiser",
      balance: "0",
      referralCode: "LIGHTJOB",
    })
    .onConflictDoNothing();

  const now = Date.now();
  await db.insert(tasksTable).values([
    {
      id: "task-welcome-survey",
      advertiserId: "seed-advertiser",
      title: "Share your first impression of LightJob",
      category: "Feedback",
      description: "Help us make the marketplace simpler by sharing a quick, thoughtful first impression.",
      instructions: "Explore the marketplace for a few minutes, then describe one thing that feels clear and one thing we could improve.",
      proofType: "text",
      requiresKyc: false,
      reward: "200.00",
      totalBudget: "20000.00",
      remainingBudget: "20000.00",
      maxCompletions: 100,
      completedCount: 0,
      status: "open",
      deadline: new Date(now + 14 * 24 * 60 * 60 * 1000),
    },
    {
      id: "task-social-discovery",
      advertiserId: "seed-advertiser",
      title: "Discover and review a new productivity tool",
      category: "Research",
      description: "Try a listed productivity product and leave a useful, specific review for future users.",
      instructions: "Open the provided product page, spend at least five minutes exploring it, and share a balanced review with a link to the page you reviewed.",
      proofType: "url",
      requiresKyc: true,
      reward: "400.00",
      totalBudget: "40000.00",
      remainingBudget: "40000.00",
      maxCompletions: 100,
      completedCount: 0,
      status: "open",
      deadline: new Date(now + 21 * 24 * 60 * 60 * 1000),
    },
    {
      id: "task-product-qa",
      advertiserId: "seed-advertiser",
      title: "Run a short usability check",
      category: "Testing",
      description: "Complete a small set of steps and report where the experience feels smooth or confusing.",
      instructions: "Follow the task checklist and submit a concise list of observations. Mention the device you used.",
      proofType: "text",
      requiresKyc: false,
      reward: "200.00",
      totalBudget: "20000.00",
      remainingBudget: "20000.00",
      maxCompletions: 100,
      completedCount: 0,
      status: "open",
      deadline: new Date(now + 30 * 24 * 60 * 60 * 1000),
    },
  ]);
  logger.info("LightJob demo data seeded");
}