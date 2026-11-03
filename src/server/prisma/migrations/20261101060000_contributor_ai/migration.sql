ALTER TABLE "AiRequest"
  ADD COLUMN "feature" TEXT NOT NULL DEFAULT 'REVIEWER',
  ADD COLUMN "workingRevisionId" TEXT,
  ALTER COLUMN "revisionId" DROP NOT NULL,
  ALTER COLUMN "assignmentId" DROP NOT NULL,
  ALTER COLUMN "accessGenerationId" DROP NOT NULL,
  ALTER COLUMN "expectedAssignmentVersion" DROP NOT NULL,
  ALTER COLUMN "selectedCriterionCount" DROP NOT NULL;

ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_feature_scope" CHECK (
  ("feature"='REVIEWER' AND "revisionId" IS NOT NULL AND "assignmentId" IS NOT NULL
   AND "accessGenerationId" IS NOT NULL AND "expectedAssignmentVersion" IS NOT NULL
   AND "selectedCriterionCount" IS NOT NULL AND "selectedCriterionCount" BETWEEN 1 AND 5 AND "workingRevisionId" IS NULL)
  OR
  ("feature"='CONTRIBUTOR' AND "workingRevisionId" IS NOT NULL AND "revisionId" IS NULL
   AND "assignmentId" IS NULL AND "accessGenerationId" IS NULL
   AND "expectedAssignmentVersion" IS NULL AND "selectedCriterionCount" IS NULL)
);
