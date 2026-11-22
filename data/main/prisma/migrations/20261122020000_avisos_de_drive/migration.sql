-- AlterTable
ALTER TABLE "integration_sources" ADD COLUMN     "changed_by" JSONB,
ADD COLUMN     "watch_channel_id" TEXT,
ADD COLUMN     "watch_expires_at" TIMESTAMP(3),
ADD COLUMN     "watch_resource_id" TEXT,
ADD COLUMN     "watch_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "integration_sources_watch_channel_id_key" ON "integration_sources"("watch_channel_id");
