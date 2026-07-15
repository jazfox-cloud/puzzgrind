PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sudoku_daily_leaderboard (
    id TEXT PRIMARY KEY,
    puzzle_id TEXT NOT NULL,
    puzzle_date TEXT NOT NULL,
    player_key_hash TEXT NOT NULL CHECK (length(player_key_hash) = 64),
    display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 2 AND 16),
    verified_completion_seconds INTEGER NOT NULL
        CHECK (verified_completion_seconds BETWEEN 30 AND 21600),
    verified_hints_used INTEGER NOT NULL CHECK (verified_hints_used >= 0),
    completed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    FOREIGN KEY (puzzle_id) REFERENCES sudoku_puzzles(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sudoku_sessions(id) ON DELETE CASCADE,
    CHECK (puzzle_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    UNIQUE (puzzle_id, player_key_hash),
    UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_sudoku_daily_leaderboard_rank
    ON sudoku_daily_leaderboard (
        puzzle_id,
        verified_hints_used,
        verified_completion_seconds,
        completed_at,
        id
    );

CREATE INDEX IF NOT EXISTS idx_sudoku_daily_leaderboard_date
    ON sudoku_daily_leaderboard (puzzle_date, created_at);

CREATE TABLE IF NOT EXISTS sudoku_leaderboard_rejections (
    id TEXT PRIMARY KEY,
    puzzle_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    reason TEXT NOT NULL
        CHECK (reason IN ('completion_too_fast', 'completion_too_slow')),
    completed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (puzzle_id) REFERENCES sudoku_puzzles(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sudoku_sessions(id) ON DELETE CASCADE,
    UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_sudoku_leaderboard_rejections_puzzle_created
    ON sudoku_leaderboard_rejections (puzzle_id, created_at);
