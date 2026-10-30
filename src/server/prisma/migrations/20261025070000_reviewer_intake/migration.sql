-- CreateEnum
CREATE TYPE "ProposalState" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ReviewAssignmentStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssignmentEndReason" AS ENUM ('DROPPED', 'ACCOUNT_DISABLED', 'REVISION_REPLACED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ProposalActivityAction" AS ENUM ('SUBMITTED', 'RESUBMITTED', 'CLAIMED', 'DROPPED', 'ASSIGNMENT_RELEASED');

-- CreateTable
CREATE TABLE "ChangeProposal" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" "ProposalState" NOT NULL DEFAULT 'DRAFT',
    "currentRevisionId" TEXT,
    "currentAssignmentId" TEXT,
    "firstSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalRevision" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "constraints" TEXT NOT NULL,
    "expectedBehavior" TEXT NOT NULL,
    "diffText" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceptanceCriterion" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AcceptanceCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestEvidence" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,

    CONSTRAINT "TestEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterionEvidenceLink" (
    "revisionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "CriterionEvidenceLink_pkey" PRIMARY KEY ("criterionId","evidenceId")
);

-- CreateTable
CREATE TABLE "ReviewAssignment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "ReviewAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" "AssignmentEndReason",
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReviewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalActivity" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "actorId" TEXT,
    "action" "ProposalActivityAction" NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "summary" TEXT NOT NULL,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangeProposal_currentAssignmentId_key" ON "ChangeProposal"("currentAssignmentId");

-- CreateIndex
CREATE INDEX "ChangeProposal_state_firstSubmittedAt_id_idx" ON "ChangeProposal"("state", "firstSubmittedAt", "id");

-- CreateIndex
CREATE INDEX "ChangeProposal_ownerId_idx" ON "ChangeProposal"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeProposal_id_currentRevisionId_currentAssignmentId_key" ON "ChangeProposal"("id", "currentRevisionId", "currentAssignmentId");

-- CreateIndex
CREATE INDEX "ProposalRevision_proposalId_number_id_idx" ON "ProposalRevision"("proposalId", "number" DESC, "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalRevision_proposalId_id_key" ON "ProposalRevision"("proposalId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalRevision_proposalId_number_key" ON "ProposalRevision"("proposalId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptanceCriterion_revisionId_id_key" ON "AcceptanceCriterion"("revisionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AcceptanceCriterion_revisionId_stableKey_key" ON "AcceptanceCriterion"("revisionId", "stableKey");

-- CreateIndex
CREATE UNIQUE INDEX "TestEvidence_revisionId_id_key" ON "TestEvidence"("revisionId", "id");

-- CreateIndex
CREATE INDEX "ReviewAssignment_reviewerId_status_assignedAt_id_idx" ON "ReviewAssignment"("reviewerId", "status", "assignedAt", "id");

-- CreateIndex
CREATE INDEX "ReviewAssignment_proposalId_assignedAt_id_idx" ON "ReviewAssignment"("proposalId", "assignedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAssignment_proposalId_revisionId_id_key" ON "ReviewAssignment"("proposalId", "revisionId", "id");

-- CreateIndex
CREATE INDEX "ProposalActivity_proposalId_timestamp_id_idx" ON "ProposalActivity"("proposalId", "timestamp", "id");

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_id_currentRevisionId_fkey" FOREIGN KEY ("id", "currentRevisionId") REFERENCES "ProposalRevision"("proposalId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_id_currentRevisionId_currentAssignmentId_fkey" FOREIGN KEY ("id", "currentRevisionId", "currentAssignmentId") REFERENCES "ReviewAssignment"("proposalId", "revisionId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ChangeProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptanceCriterion" ADD CONSTRAINT "AcceptanceCriterion_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestEvidence" ADD CONSTRAINT "TestEvidence_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProposalRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionEvidenceLink" ADD CONSTRAINT "CriterionEvidenceLink_revisionId_criterionId_fkey" FOREIGN KEY ("revisionId", "criterionId") REFERENCES "AcceptanceCriterion"("revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionEvidenceLink" ADD CONSTRAINT "CriterionEvidenceLink_revisionId_evidenceId_fkey" FOREIGN KEY ("revisionId", "evidenceId") REFERENCES "TestEvidence"("revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ChangeProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_proposalId_revisionId_fkey" FOREIGN KEY ("proposalId", "revisionId") REFERENCES "ProposalRevision"("proposalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalActivity" ADD CONSTRAINT "ProposalActivity_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ChangeProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalActivity" ADD CONSTRAINT "ProposalActivity_proposalId_revisionId_fkey" FOREIGN KEY ("proposalId", "revisionId") REFERENCES "ProposalRevision"("proposalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalActivity" ADD CONSTRAINT "ProposalActivity_proposalId_revisionId_assignmentId_fkey" FOREIGN KEY ("proposalId", "revisionId", "assignmentId") REFERENCES "ReviewAssignment"("proposalId", "revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalActivity" ADD CONSTRAINT "ProposalActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express partial indexes or deferred constraint triggers. Keep
-- these guarantees here: application root locking is additional serialization.
CREATE UNIQUE INDEX "ReviewAssignment_one_active_per_proposal"
    ON "ReviewAssignment" ("proposalId") WHERE "status" = 'ACTIVE';

ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "ChangeProposal" ADD CONSTRAINT "ChangeProposal_assignment_requires_revision"
    CHECK ("currentAssignmentId" IS NULL OR "currentRevisionId" IS NOT NULL);
ALTER TABLE "ProposalRevision" ADD CONSTRAINT "ProposalRevision_number_positive" CHECK ("number" >= 1);
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_closure_consistent" CHECK (
    ("status" = 'ACTIVE' AND "endedAt" IS NULL AND "endReason" IS NULL)
    OR ("status" = 'CLOSED' AND "endedAt" IS NOT NULL AND "endReason" IS NOT NULL AND "endedAt" >= "assignedAt")
);
ALTER TABLE "ProposalActivity" ADD CONSTRAINT "ProposalActivity_success_only" CHECK ("outcome" = 'SUCCESS');

-- Pointer and historical active row must agree at transaction commit. Deferral
-- permits create/close then root update inside one atomic command.
CREATE FUNCTION "check_current_review_assignment"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    proposal_id TEXT;
    root_record RECORD;
BEGIN
    IF TG_TABLE_NAME = 'ChangeProposal' THEN
        proposal_id := COALESCE(NEW."id", OLD."id");
    ELSE
        proposal_id := COALESCE(NEW."proposalId", OLD."proposalId");
    END IF;
    SELECT "currentRevisionId", "currentAssignmentId" INTO root_record
        FROM "ChangeProposal" WHERE "id" = proposal_id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    IF root_record."currentAssignmentId" IS NULL THEN
        IF EXISTS (SELECT 1 FROM "ReviewAssignment" WHERE "proposalId" = proposal_id AND "status" = 'ACTIVE') THEN
            RAISE EXCEPTION 'Current assignment pointer is required for an active assignment' USING ERRCODE = '23514';
        END IF;
    ELSIF NOT EXISTS (
        SELECT 1 FROM "ReviewAssignment"
        WHERE "id" = root_record."currentAssignmentId" AND "proposalId" = proposal_id
          AND "revisionId" = root_record."currentRevisionId" AND "status" = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'Current assignment pointer must identify the active same-revision assignment' USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "ChangeProposal_current_assignment_consistency"
    AFTER INSERT OR UPDATE ON "ChangeProposal" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "check_current_review_assignment"();
CREATE CONSTRAINT TRIGGER "ReviewAssignment_current_assignment_consistency"
    AFTER INSERT OR UPDATE OR DELETE ON "ReviewAssignment" DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION "check_current_review_assignment"();

-- Submitted content and business activity have no update/delete operation.
-- Operational SecurityEvent pruning has no dependency on these tables.
CREATE FUNCTION "reject_immutable_business_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Submitted snapshots and business activity are append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "ProposalRevision_immutable" BEFORE UPDATE OR DELETE ON "ProposalRevision"
    FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
CREATE TRIGGER "AcceptanceCriterion_immutable" BEFORE UPDATE OR DELETE ON "AcceptanceCriterion"
    FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
CREATE TRIGGER "TestEvidence_immutable" BEFORE UPDATE OR DELETE ON "TestEvidence"
    FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
CREATE TRIGGER "CriterionEvidenceLink_immutable" BEFORE UPDATE OR DELETE ON "CriterionEvidenceLink"
    FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
CREATE TRIGGER "ProposalActivity_append_only" BEFORE UPDATE OR DELETE ON "ProposalActivity"
    FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();

-- Assignment provenance cannot be rewritten, and a closed row cannot reopen.
CREATE FUNCTION "preserve_review_assignment_history"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Assignment history cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF (NEW."id", NEW."proposalId", NEW."revisionId", NEW."reviewerId", NEW."assignedAt")
        IS DISTINCT FROM (OLD."id", OLD."proposalId", OLD."revisionId", OLD."reviewerId", OLD."assignedAt")
        OR OLD."status" = 'CLOSED' OR NEW."version" < OLD."version" THEN
        RAISE EXCEPTION 'Assignment provenance and closed history are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "ReviewAssignment_preserve_history" BEFORE UPDATE OR DELETE ON "ReviewAssignment"
    FOR EACH ROW EXECUTE FUNCTION "preserve_review_assignment_history"();

