# Foundation completion — foundation/foundation-1

Selected gpt-6.1-sol/high. Assigned schema, migration, generated Prisma, reviewer Zod contracts and index only. No design deviations, logs/package/config/public routes/decision operations.

Models: ChangeProposal, ProposalRevision, AcceptanceCriterion, TestEvidence, CriterionEvidenceLink, ReviewAssignment, ProposalActivity. Composite same-proposal/current-revision FKs, one-ACTIVE partial index, deferred pointer agreement, immutable submitted content/activity, preserved assignment provenance and closed history. Frozen assigned roots supported without fabricated decisions. Business activity independent from operational retention.

Passed Prisma validate/generate/migrate deploy against isolated PostgreSQL; shared CJS/ESM/DTS build; shared tsc; scoped ESLint; git diff --check; eight contract smoke groups; 24 distinct physical PostgreSQL checks (atomic graph, drop/reclaim/frozen assignments, association/uniqueness/pointer consistency, immutable updates/deletes and assignment history). Fixture transactions rolled back. Initial tests twice encountered UNIQUE23505 before intended FK23503; refined fixtures passed. One lint issue fixed/revalidated; initial esbuild sandbox-access failure recovered through approved escalation, with no config workaround.

Backend must provide durable acceptance tests for authorization, locks, cursors/projections and activity. Tests may TRUNCATE only disposable fixture tables because immutable row deletes intentionally fail. No remaining foundation blocker. Coordinator interval rec-d2af400839994272; token/cache/full-runtime counters unavailable, no estimates.
