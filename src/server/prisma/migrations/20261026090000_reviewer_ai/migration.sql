-- Existing assignments each receive a fresh identity. New retained-reviewer
-- revisions may intentionally share it; uniqueness on this column is incorrect.
ALTER TABLE "ReviewAssignment" ADD COLUMN "accessGenerationId" TEXT;
UPDATE "ReviewAssignment" SET "accessGenerationId" = gen_random_uuid()::text;
ALTER TABLE "ReviewAssignment" ALTER COLUMN "accessGenerationId" SET NOT NULL;
ALTER TABLE "ReviewAssignment" ALTER COLUMN "accessGenerationId" SET DEFAULT gen_random_uuid()::text;
CREATE INDEX "ReviewAssignment_proposalId_reviewerId_accessGenerationId_idx"
 ON "ReviewAssignment"("proposalId", "reviewerId", "accessGenerationId");
CREATE FUNCTION "preserve_assignment_access_generation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."accessGenerationId" IS DISTINCT FROM OLD."accessGenerationId" THEN
  RAISE EXCEPTION 'Assignment access generation is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "ReviewAssignment_preserve_access_generation" BEFORE UPDATE ON "ReviewAssignment"
 FOR EACH ROW EXECUTE FUNCTION "preserve_assignment_access_generation"();

CREATE TYPE "AiOutcome" AS ENUM ('SUCCESS','STALE','REJECTED','FAILED','CANCELLED');
CREATE TYPE "AiErrorClass" AS ENUM (
 'DISABLED','CONFIGURATION','INPUT_LIMIT','SECRET_DETECTED','UNSUPPORTED_INPUT',
 'ACCESS_LOST','SCOPE_CHANGED','DEADLINE','RATE_LIMIT','QUEUE_FULL','PROVIDER_AUTH',
 'PROVIDER_REQUEST','PROVIDER_QUOTA','PROVIDER_TRANSIENT','TRANSPORT','INVALID_OUTPUT','CANCELLED','INTERNAL'
);
CREATE TABLE "AiRequest" (
 "id" TEXT PRIMARY KEY, "correlationId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
 "proposalId" TEXT NOT NULL, "revisionId" TEXT NOT NULL, "assignmentId" TEXT NOT NULL,
 "accessGenerationId" TEXT NOT NULL, "expectedVersion" INTEGER NOT NULL,
 "expectedAssignmentVersion" INTEGER NOT NULL, "selectedCriterionCount" INTEGER NOT NULL,
 "templateVersion" TEXT NOT NULL, "contextHash" TEXT,
 "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
 "latencyMs" INTEGER, "outcome" "AiOutcome", "errorClass" "AiErrorClass",
 "retainedUntil" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + '90 days'::interval),
 CONSTRAINT "AiRequest_safe_bounds" CHECK (
  "expectedVersion" >= 0 AND "expectedAssignmentVersion" >= 0 AND "selectedCriterionCount" BETWEEN 1 AND 5
  AND ("latencyMs" IS NULL OR "latencyMs" >= 0)
  AND ("contextHash" IS NULL OR "contextHash" ~ '^[a-f0-9]{64}$')
  AND length("templateVersion") BETWEEN 1 AND 80
  AND ("completedAt" IS NULL OR "completedAt" >= "requestedAt")
 )
);
CREATE INDEX "AiRequest_actorId_proposalId_requestedAt_id_idx" ON "AiRequest"("actorId","proposalId","requestedAt","id");
CREATE INDEX "AiRequest_retainedUntil_idx" ON "AiRequest"("retainedUntil");
CREATE TABLE "AiOutboundAttempt" (
 "id" TEXT PRIMARY KEY, "requestId" TEXT NOT NULL REFERENCES "AiRequest"("id") ON DELETE CASCADE,
 "actorId" TEXT NOT NULL, "ordinal" INTEGER NOT NULL,
 "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
 "latencyMs" INTEGER, "outcome" "AiOutcome", "errorClass" "AiErrorClass",
 "promptTokens" INTEGER, "completionTokens" INTEGER, "totalTokens" INTEGER, "cachedTokens" INTEGER,
 CONSTRAINT "AiOutboundAttempt_safe_bounds" CHECK (
  "ordinal" BETWEEN 1 AND 2 AND ("latencyMs" IS NULL OR "latencyMs" >= 0)
  AND ("promptTokens" IS NULL OR "promptTokens" >= 0)
  AND ("completionTokens" IS NULL OR "completionTokens" >= 0)
  AND ("totalTokens" IS NULL OR "totalTokens" >= 0)
  AND ("cachedTokens" IS NULL OR "cachedTokens" >= 0)
  AND ("completedAt" IS NULL OR "completedAt" >= "dispatchedAt")
 ),
 CONSTRAINT "AiOutboundAttempt_requestId_ordinal_key" UNIQUE ("requestId","ordinal")
);
CREATE INDEX "AiOutboundAttempt_actorId_dispatchedAt_idx" ON "AiOutboundAttempt"("actorId","dispatchedAt");
CREATE INDEX "AiOutboundAttempt_dispatchedAt_idx" ON "AiOutboundAttempt"("dispatchedAt");
CREATE TABLE "AiQueueLease" (
 "id" TEXT PRIMARY KEY, "requestId" TEXT NOT NULL UNIQUE, "actorId" TEXT NOT NULL,
 "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AiQueueLease_bounded_deadline" CHECK (
  "expiresAt" > "enqueuedAt" AND "expiresAt" <= "enqueuedAt" + interval '20 seconds'
 )
);
CREATE INDEX "AiQueueLease_expiresAt_enqueuedAt_id_idx" ON "AiQueueLease"("expiresAt","enqueuedAt","id");
CREATE TABLE "AiQuotaCoordinator" (
 "id" TEXT PRIMARY KEY, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "AiQuotaCoordinator" ("id") VALUES ('reviewer-patch-risk');
