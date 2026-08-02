-- Multi-part cloud files (larger PDFs without external object storage).
ALTER TABLE pm_file
  ADD COLUMN IF NOT EXISTS part_index INT NOT NULL DEFAULT 0;

ALTER TABLE pm_file
  ADD COLUMN IF NOT EXISTS part_total INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS pm_file_parts_idx
  ON pm_file (user_id, drawing_id, part_index);
