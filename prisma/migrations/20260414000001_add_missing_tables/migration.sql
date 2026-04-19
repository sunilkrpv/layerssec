-- CreateEnum
CREATE TYPE "IdentifiedBy" AS ENUM ('AI', 'USER');

CREATE TYPE "AiProvider" AS ENUM ('ANTHROPIC', 'OPENAI', 'OLLAMA', 'REPLICATE');

CREATE TYPE "AiJobType" AS ENUM ('THREAT_ANALYSIS', 'POSTURE_SCORE', 'ATTACK_SIMULATION', 'DECLUTTER');

CREATE TYPE "AiJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable threats: add identified_by and created_by_user_id
ALTER TABLE "threats"
  ADD COLUMN "identified_by" "IdentifiedBy" NOT NULL DEFAULT 'AI',
  ADD COLUMN "created_by_user_id" UUID;

ALTER TABLE "threats"
  ADD CONSTRAINT "threats_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable posture_scores
CREATE TABLE "posture_scores" (
  "id"              UUID    NOT NULL DEFAULT gen_random_uuid(),
  "project_id"      UUID    NOT NULL,
  "diagram_id"      UUID    NOT NULL,
  "diagram_version" INTEGER NOT NULL,
  "score"           INTEGER NOT NULL,
  "dimensions"      JSONB   NOT NULL,
  "deductions"      JSONB   NOT NULL,
  "additions"       JSONB   NOT NULL,
  "summary"         TEXT    NOT NULL,
  "top_recs"        JSONB   NOT NULL,
  "layer_scores"    JSONB,
  "computed_by"     UUID    NOT NULL,
  "use_extended"    BOOLEAN NOT NULL DEFAULT false,
  "analyzed_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "posture_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "posture_scores_project_id_idx" ON "posture_scores"("project_id");

ALTER TABLE "posture_scores"
  ADD CONSTRAINT "posture_scores_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "posture_scores"
  ADD CONSTRAINT "posture_scores_diagram_id_fkey"
  FOREIGN KEY ("diagram_id") REFERENCES "diagrams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable ai_jobs
CREATE TABLE "ai_jobs" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       UUID        NOT NULL,
  "project_id"    UUID,
  "diagram_id"    TEXT,
  "layer_id"      TEXT,
  "type"          "AiJobType" NOT NULL,
  "status"        "AiJobStatus" NOT NULL DEFAULT 'PENDING',
  "progress"      INTEGER     NOT NULL DEFAULT 0,
  "result_ref"    TEXT,
  "error_message" TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at"    TIMESTAMPTZ,
  "completed_at"  TIMESTAMPTZ,

  CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_jobs_user_id_idx" ON "ai_jobs"("user_id");
CREATE INDEX "ai_jobs_project_id_idx" ON "ai_jobs"("project_id");

ALTER TABLE "ai_jobs"
  ADD CONSTRAINT "ai_jobs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_jobs"
  ADD CONSTRAINT "ai_jobs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable user_ai_settings
CREATE TABLE "user_ai_settings" (
  "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"               UUID        NOT NULL,
  "provider"              "AiProvider" NOT NULL DEFAULT 'ANTHROPIC',
  "model"                 TEXT        NOT NULL DEFAULT 'claude-sonnet-4-6',
  "max_input_tokens"      INTEGER,
  "max_output_tokens"     INTEGER,
  "ollama_base_url"       TEXT,
  "open_ai_base_url"      TEXT,
  "encrypted_anthropic_key" TEXT,
  "encrypted_open_ai_key"   TEXT,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_ai_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_ai_settings_user_id_key" ON "user_ai_settings"("user_id");

ALTER TABLE "user_ai_settings"
  ADD CONSTRAINT "user_ai_settings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
