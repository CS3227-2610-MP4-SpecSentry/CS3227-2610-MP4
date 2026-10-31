-- This migration failed once after DDL was committed by the migration driver.
-- Guard only its own objects so a metadata-only rollback/redeploy can finish it.
ALTER TYPE "ProposalActivityAction" ADD VALUE IF NOT EXISTS 'APPROVAL_REVOKED';
ALTER TYPE "ProposalActivityAction" ADD VALUE IF NOT EXISTS 'RELEASE_ATTACHED';
ALTER TYPE "ProposalActivityAction" ADD VALUE IF NOT EXISTS 'RELEASE_REMOVED';
ALTER TYPE "ProposalActivityAction" ADD VALUE IF NOT EXISTS 'RELEASE_PUBLISHED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'APPROVAL_REVOKED';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='ApprovalInvalidationCause') THEN
  CREATE TYPE "ApprovalInvalidationCause" AS ENUM ('REOPENED', 'REVOKED'); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='ReleaseCandidateStatus') THEN
  CREATE TYPE "ReleaseCandidateStatus" AS ENUM ('OPEN', 'RELEASED'); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='ReleaseMemberStatus') THEN
  CREATE TYPE "ReleaseMemberStatus" AS ENUM ('ATTACHED', 'REMOVED', 'RELEASED'); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='ReleaseSmokeOutcome') THEN
  CREATE TYPE "ReleaseSmokeOutcome" AS ENUM ('PASS', 'FAIL'); END IF;
END $$;

-- The failed attempt had not run any feature endpoint. Refuse conversion if that
-- assumption is false; never rewrite smoke evidence or candidate records.
DO $$ DECLARE table_name text; has_rows boolean; BEGIN
 FOREACH table_name IN ARRAY ARRAY['ReleaseCandidate','ReleaseCandidateMember','ReleaseSmokeTest','ReleasePublicationSnapshot'] LOOP
  IF to_regclass(format('%I', table_name)) IS NOT NULL THEN
   EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I)', table_name) INTO has_rows;
   IF has_rows THEN
    RAISE EXCEPTION 'Partial release migration contains rows in %; manual recovery required', table_name USING ERRCODE='23514';
   END IF;
  END IF;
 END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS "ReleaseCandidate" (
 "id" TEXT PRIMARY KEY, "projectKey" TEXT NOT NULL, "semanticVersion" TEXT NOT NULL,
 "createdById" TEXT NOT NULL REFERENCES "UserAccount"("id") ON DELETE RESTRICT,
 "status" "ReleaseCandidateStatus" NOT NULL DEFAULT 'OPEN', "version" INTEGER NOT NULL DEFAULT 0,
 "contentVersion" INTEGER NOT NULL DEFAULT 0, "rollbackPlan" TEXT NOT NULL,
 "dependencyNotes" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "publishedAt" TIMESTAMP(3), UNIQUE("projectKey","semanticVersion"),
 CONSTRAINT "ReleaseCandidate_single_project" CHECK ("projectKey"='specsentry'),
 CONSTRAINT "ReleaseCandidate_version_label" CHECK (char_length("semanticVersion") <= 64 AND
  "semanticVersion" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
 CONSTRAINT "ReleaseCandidate_notes_limit" CHECK (char_length("rollbackPlan") <= 10000 AND
  length(btrim("rollbackPlan")) > 0 AND char_length("dependencyNotes") <= 10000),
 CONSTRAINT "ReleaseCandidate_versions_nonnegative" CHECK ("version" >= 0 AND "contentVersion" >= 0),
 CONSTRAINT "ReleaseCandidate_status_time" CHECK (("status"='OPEN' AND "publishedAt" IS NULL) OR ("status"='RELEASED' AND "publishedAt" IS NOT NULL))
);
ALTER TABLE "ReleaseCandidate" DROP CONSTRAINT IF EXISTS "ReleaseCandidate_single_project";
ALTER TABLE "ReleaseCandidate" ADD CONSTRAINT "ReleaseCandidate_single_project" CHECK ("projectKey"='specsentry');
ALTER TABLE "ReleaseCandidate" DROP CONSTRAINT IF EXISTS "ReleaseCandidate_version_label";
ALTER TABLE "ReleaseCandidate" ADD CONSTRAINT "ReleaseCandidate_version_label" CHECK (char_length("semanticVersion") <= 64 AND
  "semanticVersion" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$');
ALTER TABLE "ReleaseCandidate" DROP CONSTRAINT IF EXISTS "ReleaseCandidate_notes_limit";
ALTER TABLE "ReleaseCandidate" ADD CONSTRAINT "ReleaseCandidate_notes_limit" CHECK (char_length("rollbackPlan") <= 10000 AND
  length(btrim("rollbackPlan")) > 0 AND char_length("dependencyNotes") <= 10000);
CREATE INDEX IF NOT EXISTS "ReleaseCandidate_createdById_status_createdAt_id_idx" ON "ReleaseCandidate"("createdById","status","createdAt","id");
CREATE OR REPLACE FUNCTION "check_release_candidate_creator"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "UserAccount" WHERE "id"=NEW."createdById" AND "role"='RELEASE_MAINTAINER') THEN
  RAISE EXCEPTION 'Candidate creator must be a Maintainer' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS "ReleaseCandidate_creator_role" ON "ReleaseCandidate";
CREATE TRIGGER "ReleaseCandidate_creator_role" BEFORE INSERT ON "ReleaseCandidate" FOR EACH ROW EXECUTE FUNCTION "check_release_candidate_creator"();
ALTER TABLE "ProposalActivity" ADD COLUMN IF NOT EXISTS "candidateId" TEXT REFERENCES "ReleaseCandidate"("id") ON DELETE RESTRICT;
ALTER TABLE "ProposalActivity" DROP CONSTRAINT IF EXISTS "ProposalActivity_release_candidate_scope";
ALTER TABLE "ProposalActivity" ADD CONSTRAINT "ProposalActivity_release_candidate_scope" CHECK (
 "action"::text NOT IN ('RELEASE_ATTACHED','RELEASE_REMOVED','RELEASE_PUBLISHED') OR "candidateId" IS NOT NULL);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ReviewDecision_exact_release_approval_key') THEN
  ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_exact_release_approval_key"
    UNIQUE ("proposalId","revisionId","assignmentId","id");
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS "ReleaseCandidateMember" (
 "id" TEXT PRIMARY KEY, "candidateId" TEXT NOT NULL REFERENCES "ReleaseCandidate"("id") ON DELETE RESTRICT,
 "proposalId" TEXT NOT NULL REFERENCES "ChangeProposal"("id") ON DELETE RESTRICT,
 "revisionId" TEXT NOT NULL, "assignmentId" TEXT NOT NULL, "approvalId" TEXT NOT NULL,
 "status" "ReleaseMemberStatus" NOT NULL DEFAULT 'ATTACHED',
 "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "removedAt" TIMESTAMP(3),
 FOREIGN KEY ("proposalId","revisionId") REFERENCES "ProposalRevision"("proposalId","id") ON DELETE RESTRICT,
 FOREIGN KEY ("proposalId","revisionId","assignmentId") REFERENCES "ReviewAssignment"("proposalId","revisionId","id") ON DELETE RESTRICT,
 FOREIGN KEY ("proposalId","revisionId","assignmentId","approvalId") REFERENCES "ReviewDecision"("proposalId","revisionId","assignmentId","id") ON DELETE RESTRICT,
 CONSTRAINT "ReleaseCandidateMember_status_time" CHECK (("status"='REMOVED') = ("removedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReleaseCandidateMember_one_active_proposal" ON "ReleaseCandidateMember"("proposalId") WHERE "status" <> 'REMOVED';
CREATE INDEX IF NOT EXISTS "ReleaseCandidateMember_candidateId_status_proposalId_idx" ON "ReleaseCandidateMember"("candidateId","status","proposalId");
CREATE INDEX IF NOT EXISTS "ReleaseCandidateMember_proposalId_status_idx" ON "ReleaseCandidateMember"("proposalId","status");
CREATE OR REPLACE FUNCTION "check_release_candidate_member"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "ReviewDecision" d WHERE d."id"=NEW."approvalId" AND d."decision"='APPROVE')
   OR EXISTS (SELECT 1 FROM "ApprovalInvalidation" i WHERE i."decisionId"=NEW."approvalId")
   OR NOT EXISTS (SELECT 1 FROM "ReleaseCandidate" c WHERE c."id"=NEW."candidateId" AND c."status"='OPEN')
   OR NOT EXISTS (SELECT 1 FROM "ChangeProposal" p WHERE p."id"=NEW."proposalId"
     AND p."currentRevisionId"=NEW."revisionId" AND p."currentAssignmentId"=NEW."assignmentId"
     AND p."state" IN ('APPROVED','IN_RELEASE')) THEN
  RAISE EXCEPTION 'Candidate member requires effective approval' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS "ReleaseCandidateMember_effective_approval" ON "ReleaseCandidateMember";
CREATE TRIGGER "ReleaseCandidateMember_effective_approval" BEFORE INSERT ON "ReleaseCandidateMember" FOR EACH ROW EXECUTE FUNCTION "check_release_candidate_member"();
CREATE TABLE IF NOT EXISTS "ReleaseSmokeTest" (
 "id" TEXT PRIMARY KEY, "candidateId" TEXT NOT NULL REFERENCES "ReleaseCandidate"("id") ON DELETE RESTRICT,
 "testedContentVersion" INTEGER NOT NULL, "outcome" "ReleaseSmokeOutcome" NOT NULL,
 "procedure" TEXT NOT NULL, "results" TEXT NOT NULL,
 "actorId" TEXT NOT NULL REFERENCES "UserAccount"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReleaseSmokeTest_testedContentVersion_nonnegative" CHECK ("testedContentVersion" >= 0),
 CONSTRAINT "ReleaseSmokeTest_procedure_limit" CHECK (char_length("procedure") <= 10000 AND length(btrim("procedure")) > 0),
 CONSTRAINT "ReleaseSmokeTest_results_limit" CHECK (char_length("results") <= 10000 AND length(btrim("results")) > 0)
);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ReleaseSmokeTest' AND column_name='contentVersion') THEN
  ALTER TABLE "ReleaseSmokeTest" RENAME COLUMN "contentVersion" TO "testedContentVersion";
 END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ReleaseSmokeTest' AND column_name='note') THEN
  ALTER TABLE "ReleaseSmokeTest" RENAME COLUMN "note" TO "results";
 END IF;
END $$;
ALTER TABLE "ReleaseSmokeTest" ADD COLUMN IF NOT EXISTS "procedure" TEXT;
ALTER TABLE "ReleaseSmokeTest" ALTER COLUMN "procedure" SET NOT NULL;
ALTER TABLE "ReleaseSmokeTest" DROP CONSTRAINT IF EXISTS "ReleaseSmokeTest_contentVersion_nonnegative";
ALTER TABLE "ReleaseSmokeTest" DROP CONSTRAINT IF EXISTS "ReleaseSmokeTest_note_limit";
ALTER TABLE "ReleaseSmokeTest" DROP CONSTRAINT IF EXISTS "ReleaseSmokeTest_testedContentVersion_nonnegative";
ALTER TABLE "ReleaseSmokeTest" DROP CONSTRAINT IF EXISTS "ReleaseSmokeTest_procedure_limit";
ALTER TABLE "ReleaseSmokeTest" DROP CONSTRAINT IF EXISTS "ReleaseSmokeTest_results_limit";
ALTER TABLE "ReleaseSmokeTest" ADD CONSTRAINT "ReleaseSmokeTest_testedContentVersion_nonnegative" CHECK ("testedContentVersion" >= 0);
ALTER TABLE "ReleaseSmokeTest" ADD CONSTRAINT "ReleaseSmokeTest_procedure_limit" CHECK (char_length("procedure") <= 10000 AND length(btrim("procedure")) > 0);
ALTER TABLE "ReleaseSmokeTest" ADD CONSTRAINT "ReleaseSmokeTest_results_limit" CHECK (char_length("results") <= 10000 AND length(btrim("results")) > 0);
DROP INDEX IF EXISTS "ReleaseSmokeTest_candidateId_contentVersion_createdAt_id_idx";
CREATE INDEX IF NOT EXISTS "ReleaseSmokeTest_candidate_content_time_idx" ON "ReleaseSmokeTest"("candidateId","testedContentVersion","createdAt","id");
CREATE TABLE IF NOT EXISTS "ReleasePublicationSnapshot" (
 "id" TEXT PRIMARY KEY, "candidateId" TEXT NOT NULL UNIQUE REFERENCES "ReleaseCandidate"("id") ON DELETE RESTRICT,
 "actorId" TEXT NOT NULL REFERENCES "UserAccount"("id") ON DELETE RESTRICT,
 "candidateVersion" INTEGER NOT NULL, "contentVersion" INTEGER NOT NULL,
 "evidence" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "ApprovalInvalidation" ADD COLUMN IF NOT EXISTS "cause" "ApprovalInvalidationCause" NOT NULL DEFAULT 'REOPENED';
ALTER TABLE "ApprovalInvalidation" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "ApprovalInvalidation" ADD COLUMN IF NOT EXISTS "candidateId" TEXT REFERENCES "ReleaseCandidate"("id") ON DELETE RESTRICT;
ALTER TABLE "ApprovalInvalidation" DROP CONSTRAINT IF EXISTS "ApprovalInvalidation_cause_provenance";
ALTER TABLE "ApprovalInvalidation" ADD CONSTRAINT "ApprovalInvalidation_cause_provenance" CHECK (
 ("cause"='REOPENED' AND "reason" IS NULL AND "candidateId" IS NULL) OR
 ("cause"='REVOKED' AND "reason" IS NOT NULL AND length(btrim("reason")) > 0 AND char_length("reason") <= 2000));
-- Existing rows were produced by owner reopening. The default is their exact provenance.
CREATE OR REPLACE FUNCTION "check_approval_invalidation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "ReviewDecision" d WHERE d."id"=NEW."decisionId" AND d."decision"='APPROVE'
  AND (d."proposalId",d."revisionId",d."assignmentId")=(NEW."proposalId",NEW."revisionId",NEW."assignmentId")) THEN
  RAISE EXCEPTION 'Invalidation must reference exact approval' USING ERRCODE='23514';
 END IF;
 IF (NEW."cause"='REVOKED' AND NOT EXISTS (SELECT 1 FROM "ReviewAssignment" a
       WHERE a."id"=NEW."assignmentId" AND a."reviewerId"=NEW."actorId"))
    OR (NEW."cause"='REOPENED' AND NOT EXISTS (SELECT 1 FROM "ChangeProposal" p
       WHERE p."id"=NEW."proposalId" AND p."ownerId"=NEW."actorId")) THEN
  RAISE EXCEPTION 'Invalidation actor must own the applicable role context' USING ERRCODE='23514';
 END IF;
 IF NEW."candidateId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "ReleaseCandidateMember" m JOIN "ReleaseCandidate" c ON c."id"=m."candidateId"
   WHERE m."candidateId"=NEW."candidateId" AND c."status"='OPEN'
   AND (m."proposalId",m."revisionId",m."assignmentId",m."approvalId")=
       (NEW."proposalId",NEW."revisionId",NEW."assignmentId",NEW."decisionId")
   AND m."status"='ATTACHED') THEN
  RAISE EXCEPTION 'Invalidation candidate must contain exact approval member' USING ERRCODE='23514';
 END IF;
 IF NEW."cause"='REVOKED' AND EXISTS (
  SELECT 1 FROM "ReleaseCandidateMember" m WHERE m."proposalId"=NEW."proposalId"
   AND m."status"='ATTACHED' AND m."candidateId" IS DISTINCT FROM NEW."candidateId") THEN
  RAISE EXCEPTION 'Revocation must carry current attached candidate' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_recipientId_kind_revisionId_key";
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "candidateId" TEXT REFERENCES "ReleaseCandidate"("id") ON DELETE RESTRICT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "invalidationId" TEXT UNIQUE REFERENCES "ApprovalInvalidation"("id") ON DELETE RESTRICT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "reviewerId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "reason" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_legacy_revision_unique" ON "Notification"("recipientId","kind","revisionId")
 WHERE "kind" IN ('NEW_REVISION'::"NotificationKind",'WITHDRAWN'::"NotificationKind");
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_revocation_provenance";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_revocation_provenance" CHECK (
 ("kind"::text <> 'APPROVAL_REVOKED' AND "candidateId" IS NULL AND "invalidationId" IS NULL AND "reviewerId" IS NULL AND "reason" IS NULL) OR
 ("kind"::text = 'APPROVAL_REVOKED' AND "candidateId" IS NOT NULL AND "invalidationId" IS NOT NULL
  AND "reviewerId" IS NOT NULL AND "reason" IS NOT NULL AND length(btrim("reason")) > 0 AND char_length("reason") <= 2000));
CREATE OR REPLACE FUNCTION "preserve_notification_provenance"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Notification provenance is immutable' USING ERRCODE='23514'; END IF;
 IF (NEW."id",NEW."recipientId",NEW."kind",NEW."proposalId",NEW."revisionId",NEW."assignmentId",NEW."activityId",NEW."candidateId",NEW."invalidationId",NEW."reviewerId",NEW."reason",NEW."createdAt")
  IS DISTINCT FROM (OLD."id",OLD."recipientId",OLD."kind",OLD."proposalId",OLD."revisionId",OLD."assignmentId",OLD."activityId",OLD."candidateId",OLD."invalidationId",OLD."reviewerId",OLD."reason",OLD."createdAt")
  OR (OLD."readAt" IS NOT NULL AND NEW."readAt" IS DISTINCT FROM OLD."readAt") THEN
  RAISE EXCEPTION 'Notification provenance and acknowledgement are immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION "check_revocation_notice"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."kind"::text = 'APPROVAL_REVOKED' AND NOT EXISTS (
  SELECT 1 FROM "ApprovalInvalidation" i JOIN "ReleaseCandidate" c ON c."id"=i."candidateId"
   JOIN "ReviewAssignment" a ON a."id"=i."assignmentId"
  WHERE i."id"=NEW."invalidationId" AND i."cause"='REVOKED' AND c."id"=NEW."candidateId"
   AND c."createdById"=NEW."recipientId" AND a."reviewerId"=NEW."reviewerId"
   AND (i."proposalId",i."revisionId",i."assignmentId",i."reason")=(NEW."proposalId",NEW."revisionId",NEW."assignmentId",NEW."reason")) THEN
  RAISE EXCEPTION 'Revocation notice requires exact creator and invalidation provenance' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS "Notification_revocation_scope" ON "Notification";
CREATE TRIGGER "Notification_revocation_scope" BEFORE INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION "check_revocation_notice"();

CREATE OR REPLACE FUNCTION "preserve_release_candidate"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Candidate cannot be deleted' USING ERRCODE='23514'; END IF;
 IF (NEW."id",NEW."projectKey",NEW."createdById",NEW."createdAt") IS DISTINCT FROM
    (OLD."id",OLD."projectKey",OLD."createdById",OLD."createdAt") OR OLD."status"='RELEASED' THEN
  RAISE EXCEPTION 'Candidate identity and publication are immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS "ReleaseCandidate_preserve_identity" ON "ReleaseCandidate";
CREATE TRIGGER "ReleaseCandidate_preserve_identity" BEFORE UPDATE OR DELETE ON "ReleaseCandidate" FOR EACH ROW EXECUTE FUNCTION "preserve_release_candidate"();
CREATE OR REPLACE FUNCTION "preserve_release_member"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Member evidence cannot be deleted' USING ERRCODE='23514'; END IF;
 IF (NEW."id",NEW."candidateId",NEW."proposalId",NEW."revisionId",NEW."assignmentId",NEW."approvalId",NEW."attachedAt") IS DISTINCT FROM
    (OLD."id",OLD."candidateId",OLD."proposalId",OLD."revisionId",OLD."assignmentId",OLD."approvalId",OLD."attachedAt")
    OR OLD."status" <> 'ATTACHED' OR NEW."status" = 'ATTACHED' THEN
  RAISE EXCEPTION 'Member provenance or terminal state is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS "ReleaseCandidateMember_preserve_provenance" ON "ReleaseCandidateMember";
CREATE TRIGGER "ReleaseCandidateMember_preserve_provenance" BEFORE UPDATE OR DELETE ON "ReleaseCandidateMember" FOR EACH ROW EXECUTE FUNCTION "preserve_release_member"();
DROP TRIGGER IF EXISTS "ReleaseSmokeTest_append_only" ON "ReleaseSmokeTest";
CREATE TRIGGER "ReleaseSmokeTest_append_only" BEFORE UPDATE OR DELETE ON "ReleaseSmokeTest" FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
DROP TRIGGER IF EXISTS "ReleasePublicationSnapshot_append_only" ON "ReleasePublicationSnapshot";
CREATE TRIGGER "ReleasePublicationSnapshot_append_only" BEFORE UPDATE OR DELETE ON "ReleasePublicationSnapshot" FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
