ALTER TABLE entrees_temps ADD COLUMN paused_at TEXT;
ALTER TABLE entrees_temps ADD COLUMN total_paused_ms INTEGER NOT NULL DEFAULT 0;
