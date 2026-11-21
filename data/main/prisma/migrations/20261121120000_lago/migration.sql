-- CreateTable
CREATE TABLE "revisions" (
    "id" UUID NOT NULL,
    "document_id" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "source_pointer" TEXT NOT NULL,
    "ingest_order" SERIAL NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "role" TEXT NOT NULL,
    "locator" TEXT NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_entries" (
    "subject" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "claim_id" TEXT,
    "revision_id" TEXT NOT NULL,
    "proposal_id" TEXT,
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "baseline_entries_pkey" PRIMARY KEY ("subject","attribute")
);

-- CreateTable
CREATE TABLE "baseline_history" (
    "id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "claim_id" TEXT,
    "revision_id" TEXT NOT NULL,
    "proposal_id" TEXT,
    "since" TIMESTAMP(3) NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baseline_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "change_id" TEXT,
    "subject" TEXT NOT NULL,
    "source_revision_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "filtered" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "superseded_by_id" TEXT,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "decision" TEXT,
    "note" TEXT,
    "at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discrepancies" (
    "id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "baseline_value" JSONB NOT NULL,
    "unit" TEXT,
    "document_id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "claim_id" TEXT,
    "owner_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "backed_by_revision_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "discrepancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acknowledgements" (
    "id" UUID NOT NULL,
    "document_id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "revisions_ingest_order_key" ON "revisions"("ingest_order");

-- CreateIndex
CREATE UNIQUE INDEX "revisions_document_id_label_key" ON "revisions"("document_id", "label");

-- CreateIndex
CREATE INDEX "claims_revision_id_idx" ON "claims"("revision_id");

-- CreateIndex
CREATE INDEX "claims_subject_attribute_idx" ON "claims"("subject", "attribute");

-- CreateIndex
CREATE INDEX "baseline_history_subject_attribute_idx" ON "baseline_history"("subject", "attribute");

-- CreateIndex
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

-- CreateIndex
CREATE INDEX "proposals_subject_idx" ON "proposals"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_proposal_id_reviewer_id_key" ON "reviews"("proposal_id", "reviewer_id");

-- CreateIndex
CREATE INDEX "discrepancies_status_idx" ON "discrepancies"("status");

-- CreateIndex
CREATE INDEX "acknowledgements_document_id_idx" ON "acknowledgements"("document_id");

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_history" ADD CONSTRAINT "baseline_history_subject_attribute_fkey" FOREIGN KEY ("subject", "attribute") REFERENCES "baseline_entries"("subject", "attribute") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

