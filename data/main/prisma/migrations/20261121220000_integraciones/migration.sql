-- CreateTable
CREATE TABLE "integration_connections" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "account_email" TEXT NOT NULL,
    "scopes" TEXT[],
    "refresh_token_sealed" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_sources" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pointer" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3),
    "last_read" JSONB,
    "last_error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_provider_key" ON "integration_connections"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "integration_sources_document_id_key" ON "integration_sources"("document_id");

-- CreateIndex
CREATE INDEX "integration_sources_connection_id_idx" ON "integration_sources"("connection_id");

-- AddForeignKey
ALTER TABLE "integration_sources" ADD CONSTRAINT "integration_sources_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
