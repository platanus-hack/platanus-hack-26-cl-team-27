-- CreateTable
CREATE TABLE "aps_connections" (
    "organization_id" TEXT NOT NULL,
    "connected_by_id" UUID,
    "autodesk_user_id" TEXT NOT NULL,
    "autodesk_email" TEXT,
    "autodesk_name" TEXT,
    "scopes" TEXT NOT NULL,
    "access_token_ciphertext" TEXT NOT NULL,
    "refresh_token_ciphertext" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "refreshed_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aps_connections_pkey" PRIMARY KEY ("organization_id")
);

-- CreateIndex
CREATE INDEX "aps_connections_connected_by_id_idx" ON "aps_connections"("connected_by_id");

-- AddForeignKey
ALTER TABLE "aps_connections" ADD CONSTRAINT "aps_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aps_connections" ADD CONSTRAINT "aps_connections_connected_by_id_fkey" FOREIGN KEY ("connected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddCheck
ALTER TABLE "aps_connections" ADD CONSTRAINT "aps_connections_status_check" CHECK ("status" IN ('active', 'reconnect_required'));
