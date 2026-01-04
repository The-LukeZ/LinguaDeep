ALTER TABLE settings
ADD COLUMN deepl_version INTEGER NOT NULL DEFAULT 1;

-- Only 1 and 2 are valid values