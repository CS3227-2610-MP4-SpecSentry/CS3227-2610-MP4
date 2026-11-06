-- Candidate membership is bounded independently of the API. Locking the root
-- serializes concurrent inserts before the count is evaluated.
CREATE FUNCTION "check_release_candidate_member_capacity"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "ReleaseCandidate" WHERE "id" = NEW."candidateId" FOR UPDATE;
  IF (
    SELECT count(*) FROM "ReleaseCandidateMember"
    WHERE "candidateId" = NEW."candidateId" AND "status" <> 'REMOVED'
  ) >= 1000 THEN
    RAISE EXCEPTION 'Candidate member limit exceeded' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER "ReleaseCandidateMember_capacity"
  BEFORE INSERT ON "ReleaseCandidateMember"
  FOR EACH ROW EXECUTE FUNCTION "check_release_candidate_member_capacity"();

-- Released corrections retain the exact publication and candidate version they
-- were written against. They are append-only evidence, not mutable release text.
ALTER TABLE "ReleasePublicationSnapshot"
  ADD CONSTRAINT "ReleasePublicationSnapshot_candidate_id_key" UNIQUE ("candidateId", "id");

CREATE TABLE "ReleaseAnnotation" (
  "id" TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL REFERENCES "ReleaseCandidate"("id") ON DELETE RESTRICT,
  "snapshotId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL REFERENCES "UserAccount"("id") ON DELETE RESTRICT,
  "candidateVersion" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReleaseAnnotation_exact_publication_fkey"
    FOREIGN KEY ("candidateId", "snapshotId")
    REFERENCES "ReleasePublicationSnapshot"("candidateId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ReleaseAnnotation_candidate_version_nonnegative" CHECK ("candidateVersion" >= 0),
  CONSTRAINT "ReleaseAnnotation_text_normalized" CHECK (
    char_length("text") <= 2000 AND length(btrim("text")) > 0 AND strpos("text", chr(13)) = 0
  )
);

CREATE INDEX "ReleaseAnnotation_candidateId_createdAt_id_idx"
  ON "ReleaseAnnotation"("candidateId", "createdAt" DESC, "id" DESC);
CREATE INDEX "ReleaseAnnotation_actorId_createdAt_id_idx"
  ON "ReleaseAnnotation"("actorId", "createdAt" DESC, "id" DESC);

CREATE FUNCTION "check_release_annotation_scope"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ReleaseCandidate" c
    JOIN "UserAccount" u ON u."id" = NEW."actorId" AND u."role" = 'RELEASE_MAINTAINER'
    JOIN "ReleasePublicationSnapshot" s
      ON s."candidateId" = c."id" AND s."id" = NEW."snapshotId"
    WHERE c."id" = NEW."candidateId"
      AND c."status" = 'RELEASED'
      AND c."createdById" = NEW."actorId"
      AND c."version" = NEW."candidateVersion"
  ) THEN
    RAISE EXCEPTION 'Annotation requires the responsible Maintainer and exact released snapshot version'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER "ReleaseAnnotation_exact_scope"
  BEFORE INSERT ON "ReleaseAnnotation"
  FOR EACH ROW EXECUTE FUNCTION "check_release_annotation_scope"();
CREATE TRIGGER "ReleaseAnnotation_append_only"
  BEFORE UPDATE OR DELETE ON "ReleaseAnnotation"
  FOR EACH ROW EXECUTE FUNCTION "reject_immutable_business_change"();

-- The operational AI record owns only safe scope metadata. Maintainer requests
-- are candidate-scoped and deliberately have no business foreign keys.
ALTER TABLE "AiRequest"
  ALTER COLUMN "proposalId" DROP NOT NULL,
  ADD COLUMN "candidateId" TEXT,
  ADD COLUMN "expectedContentVersion" INTEGER,
  ADD COLUMN "candidateItemCount" INTEGER;

ALTER TABLE "AiRequest" DROP CONSTRAINT "AiRequest_feature_scope";
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_feature_scope" CHECK (
  (
    "feature" = 'REVIEWER'
    AND "proposalId" IS NOT NULL
    AND "revisionId" IS NOT NULL
    AND "assignmentId" IS NOT NULL
    AND "accessGenerationId" IS NOT NULL
    AND "expectedAssignmentVersion" IS NOT NULL
    AND "selectedCriterionCount" BETWEEN 1 AND 5
    AND "workingRevisionId" IS NULL
    AND "candidateId" IS NULL
    AND "expectedContentVersion" IS NULL
    AND "candidateItemCount" IS NULL
  ) OR (
    "feature" = 'CONTRIBUTOR'
    AND "proposalId" IS NOT NULL
    AND "workingRevisionId" IS NOT NULL
    AND "revisionId" IS NULL
    AND "assignmentId" IS NULL
    AND "accessGenerationId" IS NULL
    AND "expectedAssignmentVersion" IS NULL
    AND "selectedCriterionCount" IS NULL
    AND "candidateId" IS NULL
    AND "expectedContentVersion" IS NULL
    AND "candidateItemCount" IS NULL
  ) OR (
    "feature" = 'MAINTAINER'
    AND "proposalId" IS NULL
    AND "revisionId" IS NULL
    AND "assignmentId" IS NULL
    AND "accessGenerationId" IS NULL
    AND "workingRevisionId" IS NULL
    AND "expectedAssignmentVersion" IS NULL
    AND "selectedCriterionCount" IS NULL
    AND "candidateId" IS NOT NULL
    AND "expectedContentVersion" IS NOT NULL
    AND "expectedContentVersion" >= 0
    AND "candidateItemCount" BETWEEN 0 AND 1000
  )
);

CREATE INDEX "AiRequest_actorId_candidateId_requestedAt_id_idx"
  ON "AiRequest"("actorId", "candidateId", "requestedAt", "id");
CREATE INDEX "AiRequest_requestedAt_idx" ON "AiRequest"("requestedAt");
