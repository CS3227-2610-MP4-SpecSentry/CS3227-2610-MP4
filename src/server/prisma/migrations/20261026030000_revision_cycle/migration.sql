ALTER TYPE "ProposalActivityAction" ADD VALUE 'DRAFT_CREATED';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'DRAFT_SAVED';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'WITHDRAWN';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'REOPENED';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'NOTIFICATION_CREATED';
ALTER TABLE "ChangeProposal" ADD COLUMN "releaseAttachmentRef" TEXT;
ALTER TABLE "ProposalActivity" ALTER COLUMN "revisionId" DROP NOT NULL;
-- Use text comparisons so the newly added enum values are safe in this migration.
ALTER TABLE "ProposalActivity" ADD CONSTRAINT "ProposalActivity_draft_scope" CHECK (
  "revisionId" IS NOT NULL OR ("assignmentId" IS NULL AND "action"::text IN ('DRAFT_CREATED','DRAFT_SAVED','WITHDRAWN'))
);
CREATE TABLE "WorkingRevision" (
 "id" TEXT PRIMARY KEY, "proposalId" TEXT NOT NULL UNIQUE REFERENCES "ChangeProposal"("id") ON DELETE RESTRICT,
 "content" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TYPE "NotificationKind" AS ENUM ('NEW_REVISION','WITHDRAWN');
CREATE TABLE "Notification" (
 "id" TEXT PRIMARY KEY, "recipientId" TEXT NOT NULL REFERENCES "UserAccount"("id") ON DELETE RESTRICT,
 "kind" "NotificationKind" NOT NULL, "proposalId" TEXT NOT NULL, "revisionId" TEXT NOT NULL,
 "assignmentId" TEXT NOT NULL, "activityId" TEXT NOT NULL UNIQUE REFERENCES "ProposalActivity"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "readAt" TIMESTAMP(3),
 FOREIGN KEY ("proposalId","revisionId","assignmentId") REFERENCES "ReviewAssignment"("proposalId","revisionId","id") ON DELETE RESTRICT,
 UNIQUE ("recipientId","kind","revisionId")
);
CREATE INDEX "Notification_recipientId_createdAt_id_idx" ON "Notification"("recipientId","createdAt","id");
CREATE TABLE "ApprovalInvalidation" (
 "id" TEXT PRIMARY KEY, "proposalId" TEXT NOT NULL, "revisionId" TEXT NOT NULL, "assignmentId" TEXT NOT NULL,
 "decisionId" TEXT NOT NULL UNIQUE REFERENCES "ReviewDecision"("id") ON DELETE RESTRICT,
 "actorId" TEXT NOT NULL REFERENCES "UserAccount"("id") ON DELETE RESTRICT,
 "mutationVersion" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("proposalId","revisionId","assignmentId") REFERENCES "ReviewAssignment"("proposalId","revisionId","id") ON DELETE RESTRICT,
 UNIQUE ("proposalId","mutationVersion")
);
CREATE TRIGGER "ApprovalInvalidation_append_only" BEFORE UPDATE OR DELETE ON "ApprovalInvalidation"
 FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
CREATE FUNCTION "check_approval_invalidation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "ReviewDecision" d WHERE d."id"=NEW."decisionId" AND d."decision"='APPROVE'
  AND (d."proposalId",d."revisionId",d."assignmentId")=(NEW."proposalId",NEW."revisionId",NEW."assignmentId")) THEN
  RAISE EXCEPTION 'Invalidation must reference exact approval' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "ApprovalInvalidation_exact_decision" BEFORE INSERT ON "ApprovalInvalidation"
 FOR EACH ROW EXECUTE FUNCTION "check_approval_invalidation"();
CREATE FUNCTION "preserve_notification_provenance"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Notification provenance is immutable' USING ERRCODE='23514'; END IF;
 IF (NEW."id",NEW."recipientId",NEW."kind",NEW."proposalId",NEW."revisionId",NEW."assignmentId",NEW."activityId",NEW."createdAt")
  IS DISTINCT FROM (OLD."id",OLD."recipientId",OLD."kind",OLD."proposalId",OLD."revisionId",OLD."assignmentId",OLD."activityId",OLD."createdAt")
  OR (OLD."readAt" IS NOT NULL AND NEW."readAt" IS DISTINCT FROM OLD."readAt") THEN
  RAISE EXCEPTION 'Notification provenance and acknowledgement are immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Notification_preserve_provenance" BEFORE UPDATE OR DELETE ON "Notification"
 FOR EACH ROW EXECUTE FUNCTION "preserve_notification_provenance"();
