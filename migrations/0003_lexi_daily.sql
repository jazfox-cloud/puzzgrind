PRAGMA foreign_keys = ON;

CREATE TABLE lexi_puzzles (
    id TEXT PRIMARY KEY,
    puzzle_date TEXT NOT NULL UNIQUE
        CHECK (puzzle_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    answer TEXT NOT NULL
        CHECK (length(answer) = 5 AND answer NOT GLOB '*[^a-z]*'),
    word_length INTEGER NOT NULL DEFAULT 5 CHECK (word_length = 5),
    max_attempts INTEGER NOT NULL DEFAULT 6 CHECK (max_attempts = 6),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'validated', 'scheduled', 'published', 'archived')),
    source_reference TEXT,
    validation_version TEXT NOT NULL,
    published_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK (source_reference IS NULL OR length(trim(source_reference)) > 0)
);

CREATE INDEX idx_lexi_puzzles_status_date ON lexi_puzzles (status, puzzle_date);

CREATE TABLE lexi_sessions (
    id TEXT PRIMARY KEY,
    anonymous_id TEXT NOT NULL CHECK (length(trim(anonymous_id)) > 0),
    puzzle_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started'
        CHECK (status IN ('started', 'in_progress', 'won', 'lost', 'expired')),
    guesses_json TEXT NOT NULL DEFAULT '[]'
        CHECK (json_valid(guesses_json) AND json_type(guesses_json) = 'array'),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 6),
    hint_count INTEGER NOT NULL DEFAULT 0 CHECK (hint_count BETWEEN 0 AND 1),
    hint_letter TEXT CHECK (hint_letter IS NULL OR (length(hint_letter) = 1 AND hint_letter NOT GLOB '*[^a-z]*')),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    challenge_nonce TEXT NOT NULL CHECK (length(challenge_nonce) > 0),
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (puzzle_id) REFERENCES lexi_puzzles(id) ON DELETE RESTRICT,
    CHECK (completed_at IS NULL OR completed_at >= started_at),
    CHECK ((hint_count = 0 AND hint_letter IS NULL) OR (hint_count = 1 AND hint_letter IS NOT NULL)),
    CHECK ((status IN ('won', 'lost') AND completed_at IS NOT NULL AND duration_seconds IS NOT NULL)
        OR (status NOT IN ('won', 'lost') AND completed_at IS NULL AND duration_seconds IS NULL)),
    UNIQUE (anonymous_id, puzzle_id)
);

CREATE INDEX idx_lexi_sessions_puzzle_status ON lexi_sessions (puzzle_id, status);
CREATE INDEX idx_lexi_sessions_updated_at ON lexi_sessions (updated_at);

CREATE TABLE lexi_hint_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    puzzle_id TEXT NOT NULL,
    hint_type TEXT NOT NULL CHECK (hint_type = 'reveal_letter'),
    revealed_letter TEXT NOT NULL CHECK (length(revealed_letter) = 1 AND revealed_letter NOT GLOB '*[^a-z]*'),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES lexi_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (puzzle_id) REFERENCES lexi_puzzles(id) ON DELETE CASCADE
);

CREATE INDEX idx_lexi_hint_events_puzzle_created ON lexi_hint_events (puzzle_id, created_at);

CREATE TABLE lexi_puzzle_stats (
    puzzle_id TEXT PRIMARY KEY,
    start_count INTEGER NOT NULL DEFAULT 0 CHECK (start_count >= 0),
    win_count INTEGER NOT NULL DEFAULT 0 CHECK (win_count >= 0),
    fail_count INTEGER NOT NULL DEFAULT 0 CHECK (fail_count >= 0),
    total_attempts INTEGER NOT NULL DEFAULT 0 CHECK (total_attempts >= 0),
    total_completion_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_completion_seconds >= 0),
    total_hints INTEGER NOT NULL DEFAULT 0 CHECK (total_hints >= 0),
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (puzzle_id) REFERENCES lexi_puzzles(id) ON DELETE CASCADE,
    CHECK (win_count + fail_count <= start_count)
);

CREATE TABLE lexi_daily_leaderboard (
    id TEXT PRIMARY KEY,
    puzzle_id TEXT NOT NULL,
    puzzle_date TEXT NOT NULL,
    player_key_hash TEXT NOT NULL CHECK (length(player_key_hash) = 64),
    display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 16),
    verified_hints_used INTEGER NOT NULL CHECK (verified_hints_used BETWEEN 0 AND 1),
    verified_attempts INTEGER NOT NULL CHECK (verified_attempts BETWEEN 1 AND 6),
    verified_completion_seconds INTEGER NOT NULL CHECK (verified_completion_seconds >= 0),
    completed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    FOREIGN KEY (puzzle_id) REFERENCES lexi_puzzles(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES lexi_sessions(id) ON DELETE CASCADE,
    UNIQUE (puzzle_id, player_key_hash),
    UNIQUE (session_id)
);

CREATE INDEX idx_lexi_daily_leaderboard_rank ON lexi_daily_leaderboard (
    puzzle_id, verified_hints_used, verified_attempts,
    verified_completion_seconds, completed_at, id
);
CREATE INDEX idx_lexi_daily_leaderboard_date ON lexi_daily_leaderboard (puzzle_date, created_at);

CREATE TRIGGER lexi_leaderboard_name_immutable
BEFORE UPDATE OF display_name ON lexi_daily_leaderboard
WHEN OLD.display_name != NEW.display_name
BEGIN
  SELECT RAISE(ABORT, 'lexi_leaderboard_name_immutable');
END;

-- These triggers make aggregate changes part of the same SQLite statement as
-- the authoritative session/event transition, so retries cannot double count.
CREATE TRIGGER lexi_session_started_stats AFTER INSERT ON lexi_sessions
BEGIN
  INSERT INTO lexi_puzzle_stats (puzzle_id, start_count, updated_at)
  VALUES (NEW.puzzle_id, 1, NEW.updated_at)
  ON CONFLICT(puzzle_id) DO UPDATE SET
    start_count = start_count + 1, updated_at = excluded.updated_at;
END;

CREATE TRIGGER lexi_session_completed_stats
AFTER UPDATE OF status ON lexi_sessions
WHEN OLD.status NOT IN ('won', 'lost') AND NEW.status IN ('won', 'lost')
BEGIN
  INSERT INTO lexi_puzzle_stats (
    puzzle_id, start_count, win_count, fail_count, total_attempts,
    total_completion_seconds, total_hints, updated_at
  ) VALUES (
    NEW.puzzle_id, 1, NEW.status = 'won', NEW.status = 'lost', NEW.attempt_count,
    NEW.duration_seconds, NEW.hint_count, NEW.updated_at
  )
  ON CONFLICT(puzzle_id) DO UPDATE SET
    win_count = win_count + (NEW.status = 'won'),
    fail_count = fail_count + (NEW.status = 'lost'),
    total_attempts = total_attempts + NEW.attempt_count,
    total_completion_seconds = total_completion_seconds + NEW.duration_seconds,
    total_hints = total_hints,
    updated_at = NEW.updated_at;
END;

CREATE TRIGGER lexi_hint_applied AFTER INSERT ON lexi_hint_events
BEGIN
  UPDATE lexi_sessions
  SET hint_count = 1, hint_letter = NEW.revealed_letter, updated_at = NEW.created_at
  WHERE id = NEW.session_id AND puzzle_id = NEW.puzzle_id
    AND hint_count = 0 AND status IN ('started', 'in_progress') AND attempt_count >= 2;
  SELECT CASE WHEN changes() != 1 THEN RAISE(ABORT, 'lexi_hint_not_applicable') END;
  UPDATE lexi_puzzle_stats
  SET total_hints = total_hints + 1, updated_at = NEW.created_at
  WHERE puzzle_id = NEW.puzzle_id;
END;
