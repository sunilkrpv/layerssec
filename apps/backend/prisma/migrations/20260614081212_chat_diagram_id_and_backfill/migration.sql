-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "diagram_id" UUID;

-- CreateIndex
CREATE INDEX "chat_messages_diagram_id_idx" ON "chat_messages"("diagram_id");

-- Backfill blank diagram names to "Main Flow"
UPDATE "diagrams" SET "name" = 'Main Flow' WHERE "name" IS NULL OR "name" = '';
