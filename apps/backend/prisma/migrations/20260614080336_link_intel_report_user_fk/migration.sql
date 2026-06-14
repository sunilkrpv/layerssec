-- AddForeignKey
ALTER TABLE "project_intel_reports" ADD CONSTRAINT "project_intel_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
