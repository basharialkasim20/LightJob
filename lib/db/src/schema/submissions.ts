import { pgTable, text, numeric, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const submissionsTable = pgTable("lightjob_submissions", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  workerId: text("worker_id").notNull(),
  proof: text("proof").notNull(),
  status: text("status").notNull().default("pending"),
  reward: numeric("reward", { precision: 12, scale: 2 }).notNull(),
  reviewerNote: text("reviewer_note"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, (table) => ({
  taskWorkerUnique: uniqueIndex("lightjob_submissions_task_worker_unique").on(table.taskId, table.workerId),
}));

export const insertSubmissionSchema = createInsertSchema(submissionsTable).omit({
  submittedAt: true,
  reviewedAt: true,
});
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissionsTable.$inferSelect;