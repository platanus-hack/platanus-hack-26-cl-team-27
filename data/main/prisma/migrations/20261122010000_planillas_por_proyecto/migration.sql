-- Delete the links without an owner
DELETE FROM "integration_sources";
DELETE FROM "integration_connections";

-- DropForeignKey
ALTER TABLE "integration_sources" DROP CONSTRAINT "integration_sources_connection_id_fkey";

-- DropIndex
DROP INDEX "integration_connections_provider_key";

-- DropIndex
DROP INDEX "integration_sources_external_id_key";

-- AlterTable
ALTER TABLE "integration_connections" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "integration_sources" ADD COLUMN     "project_id" TEXT NOT NULL,
ALTER COLUMN "connection_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_user_id_provider_key" ON "integration_connections"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "integration_sources_project_id_external_id_key" ON "integration_sources"("project_id", "external_id");

-- AddForeignKey
ALTER TABLE "integration_sources" ADD CONSTRAINT "integration_sources_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

