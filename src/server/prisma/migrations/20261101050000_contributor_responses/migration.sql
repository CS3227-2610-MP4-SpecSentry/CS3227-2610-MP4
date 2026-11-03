ALTER TYPE "ProposalActivityAction" ADD VALUE 'DRAFT_CLONED';
ALTER TYPE "ProposalActivityAction" ADD VALUE 'FINDING_RESPONDED';

CREATE TABLE "FindingResponse" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "findingId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "text" TEXT NOT NULL CHECK (length(btrim("text")) > 0 AND char_length("text") <= 2000),
  "mutationVersion" INTEGER NOT NULL CHECK ("mutationVersion" > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FindingResponse_finding_scope_fkey" FOREIGN KEY ("proposalId", "findingId")
    REFERENCES "ReviewFinding"("proposalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FindingResponse_revision_scope_fkey" FOREIGN KEY ("proposalId", "revisionId")
    REFERENCES "ProposalRevision"("proposalId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FindingResponse_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FindingResponse_proposalId_mutationVersion_key" ON "FindingResponse"("proposalId", "mutationVersion");
CREATE INDEX "FindingResponse_proposalId_createdAt_id_idx" ON "FindingResponse"("proposalId", "createdAt", "id");
CREATE TRIGGER "FindingResponse_append_only" BEFORE UPDATE OR DELETE ON "FindingResponse"
  FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();
