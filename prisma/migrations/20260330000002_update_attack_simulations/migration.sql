-- CreateTable: attack_simulations
CREATE TABLE "attack_simulations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "diagram_id" UUID NOT NULL,
  "diagram_version" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL,
  "entry_point_node_id" TEXT,
  "content" TEXT NOT NULL DEFAULT '',
  "use_extended" BOOLEAN NOT NULL DEFAULT false,
  "saved_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "attack_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attack_simulations_project_id_idx" ON "attack_simulations"("project_id");

-- AddForeignKey
ALTER TABLE "attack_simulations" ADD CONSTRAINT "attack_simulations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attack_simulations" ADD CONSTRAINT "attack_simulations_diagram_id_fkey"
  FOREIGN KEY ("diagram_id") REFERENCES "diagrams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
