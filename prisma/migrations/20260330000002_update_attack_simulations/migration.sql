-- AlterTable: replace paths with content, add diagramVersion and useExtended
ALTER TABLE "attack_simulations"
  ADD COLUMN "diagram_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "use_extended" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "content" TEXT NOT NULL DEFAULT '',
  DROP COLUMN IF EXISTS "paths";

ALTER TABLE "attack_simulations"
  RENAME COLUMN "entry_point_id" TO "entry_point_node_id";
