-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('DEV', 'STAGING', 'PROD');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "compliance" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "environment" "Environment",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "repo_url" TEXT,
ADD COLUMN     "tech_stack" TEXT[] DEFAULT ARRAY[]::TEXT[];
