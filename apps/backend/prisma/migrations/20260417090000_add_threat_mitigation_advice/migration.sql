-- Add persisted AI Mitigation Advice column to threats.
ALTER TABLE "threats"
  ADD COLUMN "mitigation_advice" TEXT;
