import { pgTable, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("lightjob_tasks", {
  id: text("id").primaryKey(),
  advertiserId: text("advertiser_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions").notNull(),
  proofType: text("proof_type").notNull(),
  reward: numeric("reward", { precision: 12, scale: 2 }).notNull(),
  totalBudget: numeric("total_budget", { precision: 12, scale: 2 }).notNull(),
  remainingBudget: numeric("remaining_budget", { precision: 12, scale: 2 }).notNull(),
  maxCompletions: integer("max_completions").notNull(),
  completedCount: integer("completed_count").notNull().default(0),
  status: text("status").notNull().default("open"),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  createdAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;