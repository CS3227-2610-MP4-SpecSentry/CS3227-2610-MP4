CREATE TABLE "DraftTombstone" (
 "proposalId" TEXT PRIMARY KEY,
 "actorId" TEXT NOT NULL REFERENCES "UserAccount"("id") ON DELETE RESTRICT,
 "action" TEXT NOT NULL DEFAULT 'DRAFT_DELETED' CHECK ("action"='DRAFT_DELETED'),
 "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER "DraftTombstone_append_only" BEFORE UPDATE OR DELETE ON "DraftTombstone"
 FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();

CREATE FUNCTION "deletable_private_draft"(target TEXT, actor TEXT) RETURNS BOOLEAN LANGUAGE sql AS $$
 SELECT EXISTS (SELECT 1 FROM "ChangeProposal" p WHERE p.id=target AND p."ownerId"=actor
  AND p.state='DRAFT' AND p."firstSubmittedAt" IS NULL AND p."currentRevisionId" IS NULL
  AND p."currentAssignmentId" IS NULL AND p."releaseAttachmentRef" IS NULL)
 AND NOT EXISTS (SELECT 1 FROM "ProposalRevision" WHERE "proposalId"=target)
 AND NOT EXISTS (SELECT 1 FROM "ReviewAssignment" WHERE "proposalId"=target)
 AND NOT EXISTS (SELECT 1 FROM "CoverageAssessment" WHERE "proposalId"=target)
 AND NOT EXISTS (SELECT 1 FROM "ReviewFinding" WHERE "proposalId"=target)
 AND NOT EXISTS (SELECT 1 FROM "FindingEvent" WHERE "proposalId"=target)
 AND NOT EXISTS (SELECT 1 FROM "ReviewDecision" WHERE "proposalId"=target)
 AND NOT EXISTS (SELECT 1 FROM "ReviewIdempotency" WHERE "proposalId"=target)
 AND NOT EXISTS (SELECT 1 FROM "Notification" WHERE "proposalId"=target)
 AND NOT EXISTS (SELECT 1 FROM "ApprovalInvalidation" WHERE "proposalId"=target)
 AND NOT EXISTS (SELECT 1 FROM "ProposalActivity" WHERE "proposalId"=target AND
  ("revisionId" IS NOT NULL OR "assignmentId" IS NOT NULL OR "action"::text NOT IN ('DRAFT_CREATED','DRAFT_SAVED')));
$$;

CREATE FUNCTION "guard_draft_tombstone"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "ChangeProposal" WHERE id=NEW."proposalId" FOR UPDATE;
 IF NOT "deletable_private_draft"(NEW."proposalId",NEW."actorId")
  OR NOT EXISTS (SELECT 1 FROM "WorkingRevision" WHERE "proposalId"=NEW."proposalId") THEN
  RAISE EXCEPTION 'Only an owned never-submitted draft can be deleted' USING ERRCODE='23514';
 END IF;
 NEW."timestamp" := statement_timestamp();
 RETURN NEW;
END; $$;
CREATE TRIGGER "DraftTombstone_eligible" BEFORE INSERT ON "DraftTombstone"
 FOR EACH ROW EXECUTE FUNCTION "guard_draft_tombstone"();

-- Only deletion of an entire private draft can compact its private activity.
CREATE FUNCTION "guard_proposal_activity_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  PERFORM 1 FROM "ChangeProposal" WHERE id=OLD."proposalId" FOR UPDATE;
  IF OLD."revisionId" IS NULL AND OLD."assignmentId" IS NULL AND OLD."action"::text IN ('DRAFT_CREATED','DRAFT_SAVED')
   AND EXISTS (SELECT 1 FROM "DraftTombstone" t WHERE t."proposalId"=OLD."proposalId"
    AND "deletable_private_draft"(t."proposalId",t."actorId")) THEN RETURN OLD; END IF;
 END IF;
 RAISE EXCEPTION 'Submitted snapshots and business activity are append-only' USING ERRCODE='23514';
END; $$;
DROP TRIGGER "ProposalActivity_append_only" ON "ProposalActivity";
CREATE TRIGGER "ProposalActivity_append_only" BEFORE UPDATE OR DELETE ON "ProposalActivity"
 FOR EACH ROW EXECUTE FUNCTION "guard_proposal_activity_change"();

CREATE FUNCTION "guard_proposal_removal"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "DraftTombstone" t WHERE t."proposalId"=OLD.id
  AND "deletable_private_draft"(t."proposalId",t."actorId")) THEN
  RAISE EXCEPTION 'Proposal deletion requires an eligible draft tombstone' USING ERRCODE='23514';
 END IF;
 RETURN OLD;
END; $$;
CREATE TRIGGER "ChangeProposal_guard_removal" BEFORE DELETE ON "ChangeProposal"
 FOR EACH ROW EXECUTE FUNCTION "guard_proposal_removal"();

CREATE FUNCTION "check_draft_tombstone_complete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "ChangeProposal" WHERE id=NEW."proposalId")
  OR EXISTS (SELECT 1 FROM "WorkingRevision" WHERE "proposalId"=NEW."proposalId")
  OR EXISTS (SELECT 1 FROM "ProposalActivity" WHERE "proposalId"=NEW."proposalId") THEN
  RAISE EXCEPTION 'Draft deletion must remove all private records atomically' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "DraftTombstone_complete" AFTER INSERT ON "DraftTombstone"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "check_draft_tombstone_complete"();

-- The deferred check also sees a tombstone committed while an ID reuse waited.
CREATE FUNCTION "check_proposal_not_deleted"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "DraftTombstone" WHERE "proposalId"=NEW.id) THEN
  RAISE EXCEPTION 'Deleted proposal identity cannot be reused' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "ChangeProposal_not_deleted" AFTER INSERT OR UPDATE ON "ChangeProposal"
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "check_proposal_not_deleted"();
