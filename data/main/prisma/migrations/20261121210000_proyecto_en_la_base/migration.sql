-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "cost_owner_id" TEXT NOT NULL,
    "schedule_owner_id" TEXT NOT NULL,
    "model_document_id" TEXT,
    "longitudinal_axes" JSONB NOT NULL,
    "transversal_axes" INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "project_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "handle" TEXT NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id","id")
);

-- CreateTable
CREATE TABLE "project_spaces" (
    "project_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,

    CONSTRAINT "project_spaces_pkey" PRIMARY KEY ("project_id","id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "project_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("project_id","id")
);

-- CreateTable
CREATE TABLE "project_attributes" (
    "project_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "project_attributes_pkey" PRIMARY KEY ("project_id","key")
);

-- CreateTable
CREATE TABLE "project_subjects" (
    "project_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "spatial" JSONB,

    CONSTRAINT "project_subjects_pkey" PRIMARY KEY ("project_id","id")
);

-- CreateTable
CREATE TABLE "model_elements" (
    "project_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" INTEGER,
    "properties" JSONB NOT NULL,

    CONSTRAINT "model_elements_pkey" PRIMARY KEY ("project_id","id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "project_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("project_id","code")
);

-- CreateTable
CREATE TABLE "schedule_tasks" (
    "project_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "predecessors" TEXT[],
    "driver" JSONB,

    CONSTRAINT "schedule_tasks_pkey" PRIMARY KEY ("project_id","id")
);

-- CreateTable
CREATE TABLE "project_dependencies" (
    "project_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "watches" TEXT[],
    "stakeholder_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "measures" TEXT[],

    CONSTRAINT "project_dependencies_pkey" PRIMARY KEY ("project_id","position")
);

-- CreateTable
CREATE TABLE "project_levels" (
    "project_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "short" TEXT NOT NULL,

    CONSTRAINT "project_levels_pkey" PRIMARY KEY ("project_id","id")
);

-- CreateTable
CREATE TABLE "project_systems" (
    "project_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "occupies_space" BOOLEAN NOT NULL,

    CONSTRAINT "project_systems_pkey" PRIMARY KEY ("project_id","id")
);

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_spaces" ADD CONSTRAINT "project_spaces_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_attributes" ADD CONSTRAINT "project_attributes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_subjects" ADD CONSTRAINT "project_subjects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_elements" ADD CONSTRAINT "model_elements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_tasks" ADD CONSTRAINT "schedule_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_dependencies" ADD CONSTRAINT "project_dependencies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_levels" ADD CONSTRAINT "project_levels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_systems" ADD CONSTRAINT "project_systems_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
