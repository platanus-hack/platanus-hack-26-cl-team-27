TRUNCATE TABLE "changes", "impacts", "notifications", "revisions", "chunks", "claims", "baseline_entries", "baseline_history", "proposals", "reviews", "discrepancies", "acknowledgements", "overlaps", "overlap_votes", "seats", "room_events", "room_state";

-- DropForeignKey
ALTER TABLE "baseline_history" DROP CONSTRAINT "baseline_history_subject_attribute_fkey";

-- DropIndex
DROP INDEX "baseline_history_subject_attribute_idx";

-- DropIndex
DROP INDEX "changes_detected_at_idx";

-- DropIndex
DROP INDEX "claims_subject_attribute_idx";

-- DropIndex
DROP INDEX "discrepancies_status_idx";

-- DropIndex
DROP INDEX "overlaps_status_idx";

-- DropIndex
DROP INDEX "proposals_status_idx";

-- DropIndex
DROP INDEX "revisions_document_id_label_key";

-- DropIndex
DROP INDEX "room_events_epoch_idx";

-- AlterTable
ALTER TABLE "acknowledgements" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "baseline_entries" DROP CONSTRAINT "baseline_entries_pkey",
ADD COLUMN     "project_id" TEXT NOT NULL,
ADD CONSTRAINT "baseline_entries_pkey" PRIMARY KEY ("project_id", "subject", "attribute");

-- AlterTable
ALTER TABLE "baseline_history" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "changes" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "chunks" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "claims" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "discrepancies" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "impacts" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "overlaps" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "revisions" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "room_events" ADD COLUMN     "project_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "room_state" DROP CONSTRAINT "room_state_pkey",
DROP COLUMN "id",
ADD COLUMN     "project_id" TEXT NOT NULL,
ADD CONSTRAINT "room_state_pkey" PRIMARY KEY ("project_id");

-- AlterTable
ALTER TABLE "seats" DROP CONSTRAINT "seats_pkey",
ADD COLUMN     "project_id" TEXT NOT NULL,
ADD CONSTRAINT "seats_pkey" PRIMARY KEY ("project_id", "cast_id");

-- CreateIndex
CREATE INDEX "acknowledgements_project_id_idx" ON "acknowledgements"("project_id");

-- CreateIndex
CREATE INDEX "baseline_history_project_id_subject_attribute_idx" ON "baseline_history"("project_id", "subject", "attribute");

-- CreateIndex
CREATE INDEX "changes_project_id_detected_at_idx" ON "changes"("project_id", "detected_at");

-- CreateIndex
CREATE INDEX "chunks_project_id_idx" ON "chunks"("project_id");

-- CreateIndex
CREATE INDEX "claims_project_id_subject_attribute_idx" ON "claims"("project_id", "subject", "attribute");

-- CreateIndex
CREATE INDEX "discrepancies_project_id_status_idx" ON "discrepancies"("project_id", "status");

-- CreateIndex
CREATE INDEX "impacts_project_id_idx" ON "impacts"("project_id");

-- CreateIndex
CREATE INDEX "notifications_project_id_idx" ON "notifications"("project_id");

-- CreateIndex
CREATE INDEX "overlaps_project_id_status_idx" ON "overlaps"("project_id", "status");

-- CreateIndex
CREATE INDEX "proposals_project_id_status_idx" ON "proposals"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "revisions_project_id_document_id_label_key" ON "revisions"("project_id", "document_id", "label");

-- CreateIndex
CREATE INDEX "room_events_project_id_epoch_idx" ON "room_events"("project_id", "epoch");

-- AddForeignKey
ALTER TABLE "baseline_history" ADD CONSTRAINT "baseline_history_project_id_subject_attribute_fkey" FOREIGN KEY ("project_id", "subject", "attribute") REFERENCES "baseline_entries"("project_id", "subject", "attribute") ON DELETE CASCADE ON UPDATE CASCADE;
