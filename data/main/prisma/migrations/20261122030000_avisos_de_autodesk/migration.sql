-- CreateTable
CREATE TABLE "autodesk_events" (
    "id" UUID NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "hook_id" TEXT,
    "resource_kind" TEXT NOT NULL,
    "resource_urn" TEXT,
    "lineage_urn" TEXT,
    "name" TEXT,
    "version" INTEGER,
    "folder_urn" TEXT,
    "project_id" TEXT,
    "actor_id" TEXT,
    "occurred_at" TIMESTAMP(3),
    "needs_element_diff" BOOLEAN NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autodesk_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "autodesk_events_dedupe_key_key" ON "autodesk_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "autodesk_events_lineage_urn_idx" ON "autodesk_events"("lineage_urn");
