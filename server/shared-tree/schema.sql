-- Shared tree: anonymous, aggregated care counts. No personal data: a garden
-- is a random id made by the app, kept only to count distinct gardens per day.
CREATE TABLE IF NOT EXISTS days (
  day TEXT PRIMARY KEY,            -- UTC date, YYYY-MM-DD
  cares INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS gardens (
  day TEXT NOT NULL,
  garden TEXT NOT NULL,            -- random id from the app, not linked to a person
  cares INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, garden)
);
