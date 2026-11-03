# Login startup advice

- Prompter: yooplo, existing Git-identity inference. User asked how to run the app and log in, following Docker-free startup advice.
- Read-only checks: `.env` exists; checked configured presence of DATABASE_URL, DIRECT_DATABASE_URL and SESSION_SECRET without printing their contents. Backend `/api/ready` returned HTTP 200. Frontend port 5173 returned HTTP 200 with SpecSentry HTML. Current Node reports Windows ARM64; previous native-module failure is historical, not evidence current running backend is unavailable.
- Read local Prisma/seed/account scripts; gave existing-server URL, documented demo credentials, and separate frontend/backend restart commands. Seed is optional only against intended development database if demo accounts do not exist; seed does not reset existing accounts. No login attempt, database read of accounts, migration, seed, service start, environment edit or secret disclosure performed.
- Human verification of this AI summary pending. No product changes requested or made.
- Resource [d14e455e](resources/2026-10-31-login-startup-advice/d14e455e224e4587a597e3fd86a205f4.json) started before repository edit and finished after checks; resource report passed. Exact settings and per-record token/cache/tool/retry counters unavailable from runtime. Timing is in structured record; final logging/rendering outside interval.
