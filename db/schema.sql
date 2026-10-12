CREATE TABLE IF NOT EXISTS player_names (
  player_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  first_set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_changed_at TIMESTAMPTZ,
  next_change_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  changes INTEGER NOT NULL DEFAULT 0,
  sync_pending BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT name_length CHECK (char_length(display_name) BETWEEN 3 AND 16)
);

CREATE INDEX IF NOT EXISTS player_names_next_change_idx
  ON player_names (next_change_at);
