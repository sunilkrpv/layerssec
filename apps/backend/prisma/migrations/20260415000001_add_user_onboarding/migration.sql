-- CreateTable
CREATE TABLE "user_onboarding" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "welcome_modal_seen_at" TIMESTAMP(3),
    "ai_tour_completed_at" TIMESTAMP(3),
    "first_project_created_at" TIMESTAMP(3),
    "first_threat_analysis_at" TIMESTAMP(3),
    "checklist_dismissed_at" TIMESTAMP(3),
    "last_nudged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_onboarding_user_id_key" ON "user_onboarding"("user_id");

-- AddForeignKey
ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
