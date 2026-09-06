import { pgTable, text, numeric, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const depositsTable = pgTable(
  "lightjob_deposits",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    bankName: text("bank_name").notNull(),
    transferReference: text("transfer_reference").notNull(),
    depositReference: text("deposit_reference").notNull(),
    transferredAt: timestamp("transferred_at", { withTimezone: true }).notNull(),
    proofUrl: text("proof_url"),
    status: text("status").notNull().default("pending"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => ({
    depositReferenceIndex: index("lightjob_deposits_reference_idx").on(table.depositReference),
    transferReferenceUnique: uniqueIndex("lightjob_deposits_transfer_reference_unique").on(table.transferReference),
  }),
);

export const insertDepositSchema = createInsertSchema(depositsTable).omit({
  createdAt: true,
  reviewedAt: true,
});
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof depositsTable.$inferSelect;