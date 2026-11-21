-- DropIndex
DROP INDEX "proposals_subject_idx";

-- AlterTable
ALTER TABLE "claims" ADD COLUMN     "chunk_id" UUID,
ADD COLUMN     "confidence" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "change_ids" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "context" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "document_id" TEXT NOT NULL DEFAULT '';

UPDATE "proposals" AS p
SET "document_id" = r."document_id"
FROM "revisions" AS r
WHERE r."id"::text = p."source_revision_id";

UPDATE "proposals"
SET "change_ids" = jsonb_build_array("change_id")
WHERE "change_id" IS NOT NULL;

UPDATE "proposals"
SET "changes" = (
  SELECT COALESCE(jsonb_agg(c || jsonb_build_object('subject', "proposals"."subject", 'locator', NULL)), '[]'::jsonb)
  FROM jsonb_array_elements("proposals"."changes"::jsonb) AS c
);

ALTER TABLE "proposals" ALTER COLUMN "document_id" DROP DEFAULT;
ALTER TABLE "proposals" DROP COLUMN "subject";

-- CreateTable
CREATE TABLE "chunks" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "locator" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "rejected" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overlaps" (
    "id" UUID NOT NULL,
    "proposal_id" TEXT,
    "other_proposal_id" TEXT,
    "revision_id" TEXT NOT NULL,
    "chunk_locator" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "nivel" TEXT,
    "celda" TEXT,
    "sistemas" JSONB NOT NULL,
    "relation" TEXT,
    "subject_id" TEXT NOT NULL,
    "other_subject_id" TEXT NOT NULL,
    "other_backing" JSONB NOT NULL,
    "validators" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'abierto',
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "overlaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overlap_votes" (
    "id" UUID NOT NULL,
    "overlap_id" UUID NOT NULL,
    "validator_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overlap_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chunks_revision_id_idx" ON "chunks"("revision_id");

-- CreateIndex
CREATE INDEX "overlaps_status_idx" ON "overlaps"("status");

-- CreateIndex
CREATE INDEX "overlaps_proposal_id_idx" ON "overlaps"("proposal_id");

-- CreateIndex
CREATE UNIQUE INDEX "overlap_votes_overlap_id_validator_id_key" ON "overlap_votes"("overlap_id", "validator_id");

-- CreateIndex
CREATE INDEX "claims_chunk_id_idx" ON "claims"("chunk_id");

-- CreateIndex
CREATE INDEX "proposals_document_id_idx" ON "proposals"("document_id");

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overlap_votes" ADD CONSTRAINT "overlap_votes_overlap_id_fkey" FOREIGN KEY ("overlap_id") REFERENCES "overlaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

