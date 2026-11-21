-- DropIndex
DROP INDEX "integration_sources_document_id_key";

-- AlterTable
ALTER TABLE "integration_sources" DROP COLUMN "document_id",
DROP COLUMN "last_read",
ADD COLUMN     "changed_at" TIMESTAMP(3),
ADD COLUMN     "content_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "integration_sources_external_id_key" ON "integration_sources"("external_id");
