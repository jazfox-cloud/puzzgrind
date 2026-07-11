PRAGMA foreign_keys = ON;

CREATE TABLE sudoku_puzzles (
    id TEXT PRIMARY KEY,
    puzzle_date TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'medium'
        CHECK (difficulty = 'medium'),
    givens TEXT NOT NULL
        CHECK (length(givens) = 81 AND givens NOT GLOB '*[^0-9]*'),
    solution TEXT NOT NULL
        CHECK (length(solution) = 81 AND solution NOT GLOB '*[^1-9]*'),
    technique_profile_json TEXT
        CHECK (technique_profile_json IS NULL OR json_valid(technique_profile_json)),
    source_type TEXT,
    source_reference TEXT,
    validation_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'validated', 'scheduled', 'published', 'archived')),
    published_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK (puzzle_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    CHECK (source_reference IS NULL OR length(trim(source_reference)) > 0),
    UNIQUE (puzzle_date, difficulty)
);

CREATE INDEX idx_sudoku_puzzles_status_date
    ON sudoku_puzzles (status, puzzle_date);

CREATE TABLE sudoku_sessions (
    id TEXT PRIMARY KEY,
    anonymous_id TEXT NOT NULL CHECK (length(trim(anonymous_id)) > 0),
    puzzle_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started'
        CHECK (status IN ('started', 'in_progress', 'paused', 'won', 'rejected')),
    board_state_json TEXT NOT NULL CHECK (json_valid(board_state_json)),
    notes_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(notes_json)),
    mistakes INTEGER NOT NULL DEFAULT 0 CHECK (mistakes >= 0),
    hint_count INTEGER NOT NULL DEFAULT 0 CHECK (hint_count >= 0),
    max_hint_level INTEGER NOT NULL DEFAULT 0 CHECK (max_hint_level BETWEEN 0 AND 3),
    duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    challenge_nonce TEXT,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (puzzle_id) REFERENCES sudoku_puzzles(id) ON DELETE RESTRICT,
    CHECK (completed_at IS NULL OR completed_at >= started_at),
    UNIQUE (anonymous_id, puzzle_id)
);

CREATE INDEX idx_sudoku_sessions_puzzle_status
    ON sudoku_sessions (puzzle_id, status);

CREATE INDEX idx_sudoku_sessions_updated_at
    ON sudoku_sessions (updated_at);

CREATE TABLE sudoku_puzzle_stats (
    puzzle_id TEXT PRIMARY KEY,
    start_count INTEGER NOT NULL DEFAULT 0 CHECK (start_count >= 0),
    completion_count INTEGER NOT NULL DEFAULT 0 CHECK (completion_count >= 0),
    total_completion_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_completion_seconds >= 0),
    total_mistakes INTEGER NOT NULL DEFAULT 0 CHECK (total_mistakes >= 0),
    total_hints INTEGER NOT NULL DEFAULT 0 CHECK (total_hints >= 0),
    no_hint_completions INTEGER NOT NULL DEFAULT 0 CHECK (no_hint_completions >= 0),
    abandoned_count INTEGER NOT NULL DEFAULT 0 CHECK (abandoned_count >= 0),
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (puzzle_id) REFERENCES sudoku_puzzles(id) ON DELETE CASCADE,
    CHECK (completion_count <= start_count),
    CHECK (no_hint_completions <= completion_count)
);

CREATE TABLE sudoku_hint_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    puzzle_id TEXT NOT NULL,
    technique TEXT NOT NULL
        CHECK (technique IN ('naked_single', 'hidden_single', 'candidate_elimination', 'locked_candidates', 'box_line_reduction')),
    hint_level INTEGER NOT NULL CHECK (hint_level BETWEEN 1 AND 3),
    target_cells_json TEXT NOT NULL CHECK (json_valid(target_cells_json)),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (session_id) REFERENCES sudoku_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (puzzle_id) REFERENCES sudoku_puzzles(id) ON DELETE CASCADE
);

CREATE INDEX idx_sudoku_hint_events_session_created
    ON sudoku_hint_events (session_id, created_at);

CREATE INDEX idx_sudoku_hint_events_puzzle_created
    ON sudoku_hint_events (puzzle_id, created_at);
