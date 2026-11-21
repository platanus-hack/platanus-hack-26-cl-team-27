-- Los cambios anteriores venían de versiones de un modelo que ya no existe.
DELETE FROM "notifications";
DELETE FROM "impacts";
DELETE FROM "changes";

-- AlterTable
ALTER TABLE "changes" DROP COLUMN "integration_id",
DROP COLUMN "version",
ADD COLUMN     "source_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "snapshots";

-- CreateIndex
CREATE INDEX "changes_source_id_idx" ON "changes"("source_id");

