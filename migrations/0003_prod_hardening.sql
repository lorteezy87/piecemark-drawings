-- Production hardening: file update timestamps + workspace revision index.
-- Safe to re-run (IF NOT EXISTS / additive only).

ALTER TABLE pm_file
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS pm_workspace_revision_idx
  ON pm_workspace (revision);

CREATE INDEX IF NOT EXISTS pm_file_updated_idx
  ON pm_file (updated_at DESC);
