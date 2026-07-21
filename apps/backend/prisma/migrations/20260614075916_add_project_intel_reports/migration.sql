-- CreateTable
CREATE TABLE "project_intel_reports" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "content" TEXT NOT NULL,
    "diagram_refs" JSONB NOT NULL,
    "generated_by" UUID NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_intel_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_intel_reports_project_id_idx" ON "project_intel_reports"("project_id");

-- AddForeignKey
ALTER TABLE "project_intel_reports" ADD CONSTRAINT "project_intel_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
