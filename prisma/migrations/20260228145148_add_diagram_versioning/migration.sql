-- AlterTable
ALTER TABLE "diagrams" ADD COLUMN     "publish_comment" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';
