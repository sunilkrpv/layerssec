-- CreateEnum
CREATE TYPE "StrideCategory" AS ENUM ('SPOOFING', 'TAMPERING', 'REPUDIATION', 'INFORMATION_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE');

-- CreateEnum
CREATE TYPE "ThreatSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "ThreatStatus" AS ENUM ('IDENTIFIED', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'FALSE_POSITIVE');

-- CreateTable
CREATE TABLE "threat_models" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "diagram_id" UUID NOT NULL,
    "diagram_version" INTEGER NOT NULL,
    "snapshot_data" JSONB NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Threat Analysis',
    "saved_by" UUID NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "threat_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threats" (
    "id" UUID NOT NULL,
    "threat_model_id" UUID NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_label" TEXT NOT NULL,
    "layer_id" TEXT NOT NULL,
    "stride_category" "StrideCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ThreatSeverity" NOT NULL,
    "status" "ThreatStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "mitigation_notes" TEXT,
    "code_evidence" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "threat_models_project_id_idx" ON "threat_models"("project_id");

-- CreateIndex
CREATE INDEX "threat_models_diagram_id_idx" ON "threat_models"("diagram_id");

-- CreateIndex
CREATE INDEX "threats_threat_model_id_idx" ON "threats"("threat_model_id");

-- AddForeignKey
ALTER TABLE "threat_models" ADD CONSTRAINT "threat_models_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threat_models" ADD CONSTRAINT "threat_models_diagram_id_fkey" FOREIGN KEY ("diagram_id") REFERENCES "diagrams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threat_models" ADD CONSTRAINT "threat_models_saved_by_fkey" FOREIGN KEY ("saved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threats" ADD CONSTRAINT "threats_threat_model_id_fkey" FOREIGN KEY ("threat_model_id") REFERENCES "threat_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
