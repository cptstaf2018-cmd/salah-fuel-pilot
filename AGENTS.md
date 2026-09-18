<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Applying database migrations

`prisma migrate deploy` is deliberately **not** part of the Vercel build. `DATABASE_URL`
points at Supabase's transaction pooler (port 6543), where pgBouncer never grants the
session-level advisory lock the migration engine waits on — the step blocks until the
build is killed, which cost two production deploys 45 minutes each.

Until `DIRECT_URL` (session pooler, port 5432) is configured in the project's
environment variables, every new migration is applied by hand:

1. Write the migration under `prisma/migrations/<timestamp>_<name>/migration.sql`.
2. Generate matching SQL that also records it in `_prisma_migrations`, using the
   SHA-256 of the committed file as the checksum:
   `git show HEAD:prisma/migrations/<dir>/migration.sql | sha256sum`
3. Run it in Supabase → SQL Editor.

Skipping step 2 makes the next `prisma migrate deploy` try to re-apply the migration.
