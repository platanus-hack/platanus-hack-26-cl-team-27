-- Delete the sample project and what the lake kept from it
DELETE FROM "notifications" WHERE "project_id" = 'los-aromos';
DELETE FROM "impacts" WHERE "project_id" = 'los-aromos';
DELETE FROM "changes" WHERE "project_id" = 'los-aromos';
DELETE FROM "proposals" WHERE "project_id" = 'los-aromos';
DELETE FROM "discrepancies" WHERE "project_id" = 'los-aromos';
DELETE FROM "acknowledgements" WHERE "project_id" = 'los-aromos';
DELETE FROM "overlaps" WHERE "project_id" = 'los-aromos';
DELETE FROM "baseline_entries" WHERE "project_id" = 'los-aromos';
DELETE FROM "claims" WHERE "project_id" = 'los-aromos';
DELETE FROM "chunks" WHERE "project_id" = 'los-aromos';
DELETE FROM "revisions" WHERE "project_id" = 'los-aromos';
DELETE FROM "integration_sources" WHERE "project_id" = 'los-aromos';
DELETE FROM "projects" WHERE "id" = 'los-aromos';

-- Delete the sample organization only if it has no projects left
DELETE FROM "organizations"
WHERE "id" = 'inmobiliaria-los-aromos'
  AND NOT EXISTS (
    SELECT 1 FROM "projects" WHERE "organization_id" = 'inmobiliaria-los-aromos'
  );

-- DropTable
DROP TABLE "seats";

-- DropTable
DROP TABLE "room_state";

-- DropTable
DROP TABLE "room_events";

-- CreateTable
CREATE TABLE "project_events" (
    "project_id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "refs" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_events_pkey" PRIMARY KEY ("seq")
);

-- CreateIndex
CREATE INDEX "project_events_project_id_seq_idx" ON "project_events"("project_id", "seq");
