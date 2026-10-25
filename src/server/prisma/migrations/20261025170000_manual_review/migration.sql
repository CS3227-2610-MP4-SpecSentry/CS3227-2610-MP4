-- CreateEnum
CREATE TYPE "CoverageStatus" AS ENUM ('COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "FindingOperation" AS ENUM ('RESOLVE', 'REOPEN', 'CHANGE_SEVERITY', 'AMEND');

-- CreateEnum
CREATE TYPE "ReviewDecisionKind" AS ENUM ('APPROVE', 'REQUEST_CHANGES');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProposalActivityAction" ADD VALUE 'COVERAGE_ASSESSED';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'COVERAGE_CONFIRMED';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'FINDING_CREATED';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'FINDING_TRANSITIONED';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'FINDING_AMENDED';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'REVIEW_APPROVED';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'CHANGES_REQUESTED';

-- CreateTable
CREATE TABLE "CoverageAssessment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "status" "CoverageStatus" NOT NULL,
    "rationale" TEXT,
    "sourceCoverageId" TEXT,
    "mutationVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverageAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageEvidence" (
    "assessmentId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "CoverageEvidence_pkey" PRIMARY KEY ("assessmentId","evidenceId")
);

-- CreateTable
CREATE TABLE "ReviewFinding" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "criterionId" TEXT,
    "diffLocation" JSONB,
    "severity" "FindingSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "mutationVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingEvent" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "operation" "FindingOperation" NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "severity" "FindingSeverity" NOT NULL,
    "status" "FindingStatus" NOT NULL,
    "mutationVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "decision" "ReviewDecisionKind" NOT NULL,
    "note" TEXT,
    "mutationVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewIdempotency" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoverageAssessment_proposalId_revisionId_criterionId_mutati_idx" ON "CoverageAssessment"("proposalId", "revisionId", "criterionId", "mutationVersion");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageAssessment_proposalId_mutationVersion_key" ON "CoverageAssessment"("proposalId", "mutationVersion");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageAssessment_proposalId_revisionId_criterionId_id_key" ON "CoverageAssessment"("proposalId", "revisionId", "criterionId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CoverageAssessment_revisionId_id_key" ON "CoverageAssessment"("revisionId", "id");

-- CreateIndex
CREATE INDEX "ReviewFinding_proposalId_mutationVersion_id_idx" ON "ReviewFinding"("proposalId", "mutationVersion", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewFinding_proposalId_id_key" ON "ReviewFinding"("proposalId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewFinding_proposalId_mutationVersion_key" ON "ReviewFinding"("proposalId", "mutationVersion");

-- CreateIndex
CREATE INDEX "FindingEvent_proposalId_findingId_mutationVersion_id_idx" ON "FindingEvent"("proposalId", "findingId", "mutationVersion", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FindingEvent_proposalId_mutationVersion_key" ON "FindingEvent"("proposalId", "mutationVersion");

-- CreateIndex
CREATE INDEX "ReviewDecision_proposalId_mutationVersion_id_idx" ON "ReviewDecision"("proposalId", "mutationVersion", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewDecision_proposalId_revisionId_key" ON "ReviewDecision"("proposalId", "revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewDecision_proposalId_mutationVersion_key" ON "ReviewDecision"("proposalId", "mutationVersion");

-- CreateIndex
CREATE INDEX "ReviewIdempotency_expiresAt_idx" ON "ReviewIdempotency"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewIdempotency_actorId_operation_proposalId_keyHash_key" ON "ReviewIdempotency"("actorId", "operation", "proposalId", "keyHash");

-- AddForeignKey
ALTER TABLE "CoverageAssessment" ADD CONSTRAINT "CoverageAssessment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ChangeProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageAssessment" ADD CONSTRAINT "CoverageAssessment_proposalId_revisionId_assignmentId_fkey" FOREIGN KEY ("proposalId", "revisionId", "assignmentId") REFERENCES "ReviewAssignment"("proposalId", "revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageAssessment" ADD CONSTRAINT "CoverageAssessment_revisionId_criterionId_fkey" FOREIGN KEY ("revisionId", "criterionId") REFERENCES "AcceptanceCriterion"("revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageAssessment" ADD CONSTRAINT "CoverageAssessment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageAssessment" ADD CONSTRAINT "CoverageAssessment_proposalId_revisionId_criterionId_sourc_fkey" FOREIGN KEY ("proposalId", "revisionId", "criterionId", "sourceCoverageId") REFERENCES "CoverageAssessment"("proposalId", "revisionId", "criterionId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CoverageEvidence" ADD CONSTRAINT "CoverageEvidence_revisionId_assessmentId_fkey" FOREIGN KEY ("revisionId", "assessmentId") REFERENCES "CoverageAssessment"("revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageEvidence" ADD CONSTRAINT "CoverageEvidence_revisionId_evidenceId_fkey" FOREIGN KEY ("revisionId", "evidenceId") REFERENCES "TestEvidence"("revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFinding" ADD CONSTRAINT "ReviewFinding_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ChangeProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFinding" ADD CONSTRAINT "ReviewFinding_proposalId_revisionId_assignmentId_fkey" FOREIGN KEY ("proposalId", "revisionId", "assignmentId") REFERENCES "ReviewAssignment"("proposalId", "revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFinding" ADD CONSTRAINT "ReviewFinding_revisionId_criterionId_fkey" FOREIGN KEY ("revisionId", "criterionId") REFERENCES "AcceptanceCriterion"("revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFinding" ADD CONSTRAINT "ReviewFinding_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingEvent" ADD CONSTRAINT "FindingEvent_proposalId_findingId_fkey" FOREIGN KEY ("proposalId", "findingId") REFERENCES "ReviewFinding"("proposalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingEvent" ADD CONSTRAINT "FindingEvent_proposalId_revisionId_assignmentId_fkey" FOREIGN KEY ("proposalId", "revisionId", "assignmentId") REFERENCES "ReviewAssignment"("proposalId", "revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingEvent" ADD CONSTRAINT "FindingEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ChangeProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_proposalId_revisionId_assignmentId_fkey" FOREIGN KEY ("proposalId", "revisionId", "assignmentId") REFERENCES "ReviewAssignment"("proposalId", "revisionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIdempotency" ADD CONSTRAINT "ReviewIdempotency_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ChangeProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIdempotency" ADD CONSTRAINT "ReviewIdempotency_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Review records are append-only; mutationVersion orders same-millisecond writes.
CREATE TRIGGER "CoverageAssessment_append_only" BEFORE UPDATE OR DELETE ON "CoverageAssessment"
 FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
CREATE TRIGGER "CoverageEvidence_append_only" BEFORE UPDATE OR DELETE ON "CoverageEvidence"
 FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
CREATE TRIGGER "ReviewFinding_append_only" BEFORE UPDATE OR DELETE ON "ReviewFinding"
 FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
CREATE TRIGGER "FindingEvent_append_only" BEFORE UPDATE OR DELETE ON "FindingEvent"
 FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
CREATE TRIGGER "ReviewDecision_append_only" BEFORE UPDATE OR DELETE ON "ReviewDecision"
 FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
ALTER TABLE "CoverageAssessment" ADD CONSTRAINT "CoverageAssessment_rationale_required" CHECK
 ("status" = 'COVERED' OR length(btrim("rationale")) > 0 AND "rationale" IS NOT NULL);
ALTER TABLE "FindingEvent" ADD CONSTRAINT "FindingEvent_reason_required" CHECK (length(btrim("reason")) > 0);
ALTER TABLE "FindingEvent" ADD CONSTRAINT "FindingEvent_amendment_description" CHECK
 (("operation" = 'AMEND' AND "description" IS NOT NULL AND length(btrim("description")) > 0)
 OR ("operation" <> 'AMEND' AND "description" IS NULL));
-- Confirmations preserve precisely the current predecessor values; no client-owned inheritance.
CREATE FUNCTION "check_coverage_confirmation"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous RECORD;
BEGIN
 IF NEW."sourceCoverageId" IS NOT NULL THEN
  SELECT * INTO previous FROM "CoverageAssessment" WHERE "id" = NEW."sourceCoverageId";
  IF previous."mutationVersion" <> (SELECT max("mutationVersion") FROM "CoverageAssessment"
   WHERE "proposalId"=NEW."proposalId" AND "revisionId"=NEW."revisionId" AND "criterionId"=NEW."criterionId")
   OR previous."assignmentId" = NEW."assignmentId"
   OR (previous."status",previous."rationale") IS DISTINCT FROM (NEW."status",NEW."rationale") THEN
   RAISE EXCEPTION 'Confirmation requires the current inherited assessment' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "CoverageAssessment_confirm_current" BEFORE INSERT ON "CoverageAssessment"
 FOR EACH ROW EXECUTE FUNCTION "check_coverage_confirmation"();
