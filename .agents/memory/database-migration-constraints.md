---
name: Database migration constraints
description: Safe handling of nullable unique fields when existing development rows are present.
---

When adding a nullable identity/reference field to an existing table, do not accept an automated migration prompt that proposes truncating live development rows. Prefer a non-destructive additive column and enforce deterministic reference generation in application logic until a safe backfill-and-constraint migration is available.

**Why:** Drizzle can interpret an added unique constraint as requiring a destructive table reset in a non-interactive workflow, even when the intended field is nullable.

**How to apply:** Inspect existing rows before adding unique constraints; never use force/truncate to unblock CI or workflow schema pushes without explicit approval.