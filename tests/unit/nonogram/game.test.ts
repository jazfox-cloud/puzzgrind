import { describe, expect, it } from "vitest";

import { createState, formatDuration, isComplete, markForToggle, paintCell, redo, resetState, setTool, tick, toggleCell, undo } from "@/lib/nonogram/game";

const solution = [1, 0, 1, 0];

describe("Nonogram play state", () => {
  it("toggles fill and cross, then undoes and redoes", () => {
    const filled = toggleCell(createState(4), 0, solution);
    expect(filled.cells).toEqual(["fill", "empty", "empty", "empty"]);
    expect(filled.completed).toBe(false);
    const crossed = toggleCell(setTool(filled, "cross"), 1, solution);
    expect(crossed.cells[1]).toBe("cross");
    expect(crossed.tool).toBe("cross");
    const cleared = toggleCell(crossed, 1, solution);
    expect(cleared.cells[1]).toBe("empty");
    const undone = undo(cleared, solution);
    expect(undone.cells[1]).toBe("cross");
    const redone = redo(undone, solution);
    expect(redone.cells[1]).toBe("empty");
    expect(redo(redone, solution)).toBe(redone);
  });

  it("completes only when the filled cells match, with crosses optional", () => {
    let state = createState(4);
    state = paintCell(state, 0, "fill", solution);
    state = paintCell(state, 2, "fill", solution);
    expect(isComplete(state.cells, solution)).toBe(true);
    expect(state.completed).toBe(true);
    const marked = paintCell(createState(4), 0, "fill", solution);
    const withCross = paintCell(paintCell(marked, 2, "fill", solution), 1, "cross", solution);
    expect(isComplete(["fill", "cross", "fill", "empty"], solution)).toBe(true);
    expect(isComplete(["fill", "empty", "fill", "fill"], solution)).toBe(false);
    expect(isComplete(["cross", "empty", "fill", "empty"], solution)).toBe(false);
    expect(paintCell(paintCell(createState(4), 0, "fill", solution), 3, "fill", solution).completed).toBe(false);
    expect(paintCell(withCross, 3, "fill", solution)).toBe(withCross);
    expect(paintCell(state, 3, "cross", solution)).toBe(state);
  });

  it("resets the board and timer, keeps the tool, and stops the clock after a win", () => {
    const started = tick(tick(setTool(createState(4), "cross")));
    const solved = paintCell(paintCell(started, 0, "fill", solution), 2, "fill", solution);
    expect(tick(solved).seconds).toBe(2);
    const reset = resetState(solved);
    expect(reset.cells.every((cell) => cell === "empty")).toBe(true);
    expect(reset.seconds).toBe(0);
    expect(reset.history).toEqual([]);
    expect(reset.future).toEqual([]);
    expect(reset.completed).toBe(false);
    expect(reset.tool).toBe("cross");
    expect(formatDuration(2)).toBe("00:02");
    expect(formatDuration(75)).toBe("01:15");
  });

  it("drops the oldest undo once history is full and clears redo after a new mark", () => {
    let state = createState(4);
    for (let step = 0; step < 101; step += 1) state = paintCell(state, 1, step % 2 === 0 ? "fill" : "empty", solution);
    expect(state.history).toHaveLength(100);
    const undone = undo(state, solution);
    const edited = paintCell(undone, 3, "cross", solution);
    expect(edited.future).toEqual([]);
    expect(markForToggle("fill", "fill")).toBe("empty");
    expect(paintCell(state, 99, "fill", solution)).toBe(state);
  });
});
