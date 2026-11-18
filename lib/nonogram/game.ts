/** Pure Nonogram play state: marks, undo, redo, reset, timer, and completion. */

export type Mark = "empty" | "fill" | "cross";
export type Tool = "fill" | "cross";

export type NonogramState = {
  cells: Mark[];
  history: Mark[][];
  future: Mark[][];
  tool: Tool;
  seconds: number;
  completed: boolean;
};

const HISTORY_LIMIT = 100;

export function createState(cellCount: number, tool: Tool = "fill"): NonogramState {
  if (!Number.isInteger(cellCount) || cellCount < 1) throw new Error("A puzzle needs at least one cell");
  return { cells: Array.from({ length: cellCount }, () => "empty" as const), history: [], future: [], tool, seconds: 0, completed: false };
}

export function isComplete(cells: readonly Mark[], solution: readonly number[]): boolean {
  return cells.length === solution.length && solution.every((bit, index) => (bit === 1) === (cells[index] === "fill"));
}

export function markForToggle(current: Mark, tool: Tool): Mark {
  const next = tool === "fill" ? "fill" : "cross";
  return current === next ? "empty" : next;
}

function finish(state: NonogramState, cells: Mark[], solution: readonly number[], recordHistory: boolean): NonogramState {
  if (cells.length === state.cells.length && cells.every((cell, index) => cell === state.cells[index])) return state;
  return {
    ...state,
    cells,
    history: recordHistory ? [...state.history, state.cells].slice(-HISTORY_LIMIT) : state.history,
    future: recordHistory ? [] : state.future,
    completed: isComplete(cells, solution),
  };
}

export function paintCell(state: NonogramState, index: number, mark: Mark, solution: readonly number[]): NonogramState {
  if (state.completed || !Number.isInteger(index) || index < 0 || index >= state.cells.length || state.cells.length !== solution.length) return state;
  if (state.cells[index] === mark) return state;
  const cells = state.cells.slice();
  cells[index] = mark;
  return finish(state, cells, solution, true);
}

export function toggleCell(state: NonogramState, index: number, solution: readonly number[]): NonogramState {
  const current = state.cells[index];
  if (current === undefined) return state;
  return paintCell(state, index, markForToggle(current, state.tool), solution);
}

export function setTool(state: NonogramState, tool: Tool): NonogramState {
  return state.tool === tool ? state : { ...state, tool };
}

export function undo(state: NonogramState, solution: readonly number[]): NonogramState {
  const previous = state.history.at(-1);
  if (!previous) return state;
  return { ...state, cells: previous, history: state.history.slice(0, -1), future: [...state.future, state.cells], completed: isComplete(previous, solution) };
}

export function redo(state: NonogramState, solution: readonly number[]): NonogramState {
  const next = state.future.at(-1);
  if (!next) return state;
  return { ...state, cells: next, history: [...state.history, state.cells].slice(-HISTORY_LIMIT), future: state.future.slice(0, -1), completed: isComplete(next, solution) };
}

export function resetState(state: NonogramState): NonogramState {
  return createState(state.cells.length, state.tool);
}

export function tick(state: NonogramState): NonogramState {
  if (state.completed) return state;
  return { ...state, seconds: state.seconds + 1 };
}

export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
