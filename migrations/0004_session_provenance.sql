ALTER TABLE sudoku_sessions ADD COLUMN source_environment TEXT NOT NULL DEFAULT 'unknown'
  CHECK (source_environment IN ('unknown','local','test','preview','staging','production'));

ALTER TABLE lexi_sessions ADD COLUMN source_environment TEXT NOT NULL DEFAULT 'unknown'
  CHECK (source_environment IN ('unknown','local','test','preview','staging','production'));
