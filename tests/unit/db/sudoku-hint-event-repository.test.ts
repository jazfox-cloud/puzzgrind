import { describe, expect, it } from "vitest";

import { SudokuHintEventRepository } from "@/lib/db";
import type { SudokuHintEvent } from "@/lib/db";
import { FakeD1Database } from "./fake-d1";

const event: SudokuHintEvent = {
  id: "hint-1",
  sessionId: "session-1",
  puzzleId: "puzzle-1",
  technique: "hidden_single",
  hintLevel: 2,
  targetCells: [12, 13],
  createdAt: 300,
};

describe("SudokuHintEventRepository", () => {
  it("writes structured hint metadata without a board or solution", async () => {
    const db = new FakeD1Database();
    db.queueRun();

    await new SudokuHintEventRepository(db).create(event);

    expect(db.statements[0].bindings).toEqual([
      "hint-1",
      "session-1",
      "puzzle-1",
      "hidden_single",
      2,
      "[12,13]",
      300,
    ]);
    expect(db.statements[0].query).not.toContain("solution");
    expect(db.statements[0].query).not.toContain("board_state");
  });

  it("lists and maps events in server order", async () => {
    const db = new FakeD1Database();
    db.queueAll([
      {
        id: "hint-1",
        session_id: "session-1",
        puzzle_id: "puzzle-1",
        technique: "naked_single",
        hint_level: 1,
        target_cells_json: "[8]",
        created_at: 200,
      },
    ]);

    const result = await new SudokuHintEventRepository(db).listBySessionId("session-1");

    expect(result).toEqual([
      {
        id: "hint-1",
        sessionId: "session-1",
        puzzleId: "puzzle-1",
        technique: "naked_single",
        hintLevel: 1,
        targetCells: [8],
        createdAt: 200,
      },
    ]);
  });
});
