-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "snapshots" (
    "id" UUID NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "elements" JSONB NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "changes" (
    "id" UUID NOT NULL,
    "integration_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "element_id" TEXT NOT NULL,
    "element_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "diffs" JSONB NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impacts" (
    "change_id" UUID NOT NULL,
    "cost_delta" INTEGER NOT NULL,
    "delay_days" INTEGER NOT NULL,
    "detail" JSONB NOT NULL,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impacts_pkey" PRIMARY KEY ("change_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "change_id" UUID NOT NULL,
    "stakeholder_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "findings" JSONB NOT NULL,
    "link" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" TEXT,
    "response_note" TEXT,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "snapshots_integration_id_version_key" ON "snapshots"("integration_id", "version");

-- CreateIndex
CREATE INDEX "changes_detected_at_idx" ON "changes"("detected_at");

-- CreateIndex
CREATE INDEX "notifications_change_id_idx" ON "notifications"("change_id");

-- CreateIndex
CREATE INDEX "notifications_stakeholder_id_idx" ON "notifications"("stakeholder_id");

