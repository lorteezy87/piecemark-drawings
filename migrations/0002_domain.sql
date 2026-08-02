-- PieceMark domain schema (multi-user ready). All tenant data scoped by user_id.
-- Prefer TEXT user_id (matches Better Auth + preview 'dev-user').

CREATE TABLE IF NOT EXISTS pm_workspace (
  user_id TEXT NOT NULL PRIMARY KEY,
  package_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revision INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pm_file (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  drawing_id TEXT,
  kind TEXT NOT NULL DEFAULT 'sheet',
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  -- base64 for small/medium files; large files should move to object storage later
  content_b64 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_file_user_idx ON pm_file (user_id);
CREATE INDEX IF NOT EXISTS pm_file_drawing_idx ON pm_file (drawing_id);

CREATE TABLE IF NOT EXISTS pm_project (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_number TEXT NOT NULL,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_project_user_idx ON pm_project (user_id);
