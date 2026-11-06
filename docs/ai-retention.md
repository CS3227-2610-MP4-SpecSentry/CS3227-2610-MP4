# AI record retention maintenance

From `src/server`, explicitly run `node -r ts-node/register src/ai/cleanup-ai-records.ts` with the intended server-side `DATABASE_URL`. The command loads the root `.env` without overriding existing environment variables, validates the PostgreSQL URL, makes no provider calls, and closes its database connection. It needs the existing migrated/seeded AI quota coordinator and database permission to delete AI records. It prints only a fixed success/failure message and exits nonzero on failure; never place a connection string in a command or log.

The command shares `PrismaAiAccounting.cleanup(deadline)` with opportunistic gateway cleanup. Each invocation has the existing bounded 20-second deadline. One transaction acquires the same quota coordinator lock used by enqueue/reserve and then captures one cutoff time. Failure, timeout, or a missing coordinator rolls back deletion.

Expired leases (`expiresAt <= now`) are removed. Requests are eligible only at `retainedUntil <= now`, with no unexpired lease and no request/attempt start or completion timestamp within the previous 24 hours. Equality at that 24-hour boundary and future timestamps are protected. Old abandoned incomplete requests can eventually expire; related attempts cascade. Unexpired orphan leases survive until their own expiry. This preserves the longest SGT daily quota window and bounded active requests. Business history, security events, TTLs, and schemas are unchanged.

This is an explicit server-only maintenance mechanism. No scheduler, application activation, browser endpoint, deployment identity, cadence, monitoring, retries, or outage recovery is installed. Deployment owners must arrange and verify those separately before claiming scheduled physical deletion or retention compliance. The mechanism covers AI request, attempt, and lease records only.

Tests: `npm test -- --runTestsByPath test/ai-retention.spec.ts` and, against an explicitly isolated disposable `TEST_DATABASE_URL`, `npm run test:integration -- --runTestsByPath test/ai-retention.integration.ts`. Integration tests delete only their synthetic AI/business fixtures; never point them at runtime data.
