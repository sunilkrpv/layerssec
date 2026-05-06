-- CreateEnum
CREATE TYPE "DiagramType" AS ENUM ('GENERAL', 'PATENT', 'C4_CONTEXT', 'C4_CONTAINER', 'C4_COMPONENT', 'C4_CODE', 'AWS_ARCHITECTURE', 'CLOUD_INFRASTRUCTURE', 'FLOWCHART', 'SEQUENCE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" UUID NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagrams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiagramType" NOT NULL DEFAULT 'GENERAL',
    "canvas_data" JSONB NOT NULL DEFAULT '{}',
    "thumbnail" TEXT,
    "project_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagrams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_interactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "diagram_id" UUID,
    "prompt" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "tokens_used" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");

-- CreateIndex
CREATE INDEX "diagrams_project_id_idx" ON "diagrams"("project_id");

-- CreateIndex
CREATE INDEX "ai_interactions_user_id_idx" ON "ai_interactions"("user_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
