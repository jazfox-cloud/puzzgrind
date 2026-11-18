"use client";

import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { bankFor, puzzleForDate, puzzleNumber } from "@/lib/nonogram/calendar";
import { utcDate } from "@/lib/daily/utc";
import { createState, formatDuration, markForToggle, paintCell, redo, resetState, setTool, tick, undo, type Mark, type NonogramState, type Tool } from "@/lib/nonogram/game";
import { loadNonogram, loadPreferredSize, saveNonogram } from "@/lib/nonogram/storage";
import type { NonogramPuzzle, NonogramSize } from "@/lib/nonogram/puzzles";

type View = { date: string; size: NonogramSize; puzzle: NonogramPuzzle; game: NonogramState };

function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

function loadView(date: string, size: NonogramSize, storage: Storage | null): View {
  const puzzle = puzzleForDate(size, date);
  const game = storage ? loadNonogram(storage, puzzle.id, puzzle.solution) ?? createState(puzzle.solution.length) : createState(puzzle.solution.length);
  return { date, size, puzzle, game };
}

export function NonogramGame() {
  const [view, setView] = useState<View | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [selected, setSelected] = useState(0);
  const [clockGeneration, setClockGeneration] = useState(0);
  const viewRef = useRef<View | null>(null);
  const drag = useRef<Mark | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const completeDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const storage = browserStorage();
    const open = (date: string, size: NonogramSize) => {
      try { setView(loadView(date, size, storage)); }
      catch { setStorageError(true); setView(loadView(date, size, null)); }
      setSelected(0);
    };
    open(utcDate(), storage ? loadPreferredSize(storage) : 5);
    const watch = () => {
      const current = viewRef.current;
      const date = utcDate();
      if (current && date !== current.date) open(date, current.size);
    };
    const interval = window.setInterval(watch, 15_000);
    document.addEventListener("visibilitychange", watch);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", watch); };
  }, []);

  useEffect(() => {
    if (!view) return;
    const storage = browserStorage();
    let failed = !storage;
    if (storage) {
      try { saveNonogram(storage, view.puzzle.id, view.game, view.size); }
      catch { failed = true; }
    }
    if (failed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- surface a browser storage failure without blocking play
      setStorageError(true);
    }
  }, [view]);

  const timerActive = view !== null && !view.game.completed;
  const timerPuzzle = view?.puzzle.id;
  useEffect(() => {
    if (!timerActive) return;
    const interval = window.setInterval(() => {
      setView((current) => current && current.puzzle.id === timerPuzzle && !current.game.completed ? { ...current, game: tick(current.game) } : current);
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [timerActive, timerPuzzle, clockGeneration]);

  useEffect(() => {
    const dialog = completeDialog.current;
    if (!dialog || !view) return;
    if (view.game.completed && !dialog.open) dialog.showModal();
    else if (!view.game.completed && dialog.open) dialog.close();
  }, [view]);

  function update(change: (game: NonogramState, puzzle: NonogramPuzzle) => NonogramState) {
    setView((current) => {
      if (!current) return current;
      const game = change(current.game, current.puzzle);
      return game === current.game ? current : { ...current, game };
    });
  }

  function chooseSize(size: NonogramSize) {
    const storage = browserStorage();
    setView((current) => current && current.size !== size ? loadView(current.date, size, storage) : current);
    setSelected(0);
  }

  function focusCell(index: number) {
    setSelected(index);
    document.getElementById(`nonogram-cell-${index}`)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!view) return;
    const { size } = view.puzzle;
    const key = event.key.toLowerCase();
    const row = Math.floor(selected / size);
    const column = selected % size;
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const nextRow = Math.max(0, Math.min(size - 1, row + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0)));
      const nextColumn = Math.max(0, Math.min(size - 1, column + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0)));
      focusCell(nextRow * size + nextColumn);
      return;
    }
    if (key === "f" || key === "1") { event.preventDefault(); paintSelected("fill"); }
    else if (key === "x" || key === "2") { event.preventDefault(); paintSelected("cross"); }
    else if (event.key === "Delete" || event.key === "Backspace" || key === "0") { event.preventDefault(); update((game, puzzle) => paintCell(game, selected, "empty", puzzle.solution)); }
    else if (key === "z") { event.preventDefault(); update((game, puzzle) => undo(game, puzzle.solution)); }
    else if (key === "y") { event.preventDefault(); update((game, puzzle) => redo(game, puzzle.solution)); }
  }

  function paintSelected(tool: Tool) {
    update((game, puzzle) => {
      const armed = setTool(game, tool);
      const current = armed.cells[selected];
      if (current === undefined) return game;
      return paintCell(armed, selected, markForToggle(current, tool), puzzle.solution);
    });
  }

  function cellIndex(target: EventTarget | null) {
    const element = target instanceof Element ? target.closest("[data-cell-index]") : null;
    const value = element?.getAttribute("data-cell-index");
    return value === null || value === undefined ? null : Number(value);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!view || view.game.completed || event.button !== 0) return;
    const index = cellIndex(event.target);
    if (index === null || !Number.isInteger(index) || view.game.cells[index] === undefined) return;
    event.preventDefault();
    boardRef.current?.setPointerCapture(event.pointerId);
    const mark = markForToggle(view.game.cells[index], view.game.tool);
    drag.current = mark;
    update((game, puzzle) => paintCell(game, index, mark, puzzle.solution));
    focusCell(index);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const mark = drag.current;
    if (!mark) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const index = cellIndex(hit);
    if (index === null) return;
    update((game, puzzle) => paintCell(game, index, mark, puzzle.solution));
    setSelected(index);
  }

  function stopDrag() { drag.current = null; }

  if (!view) return <p role="status" className="mx-auto max-w-xl rounded-2xl bg-white/75 p-4 text-sm font-semibold">Choosing the UTC puzzle for today…</p>;

  const { puzzle, game } = view;
  const size = puzzle.size;
  const filled = game.cells.filter((cell) => cell === "fill").length;
  const crossed = game.cells.filter((cell) => cell === "cross").length;
  const button = "min-h-11 rounded-xl border border-emerald-950/20 bg-white px-3 py-2 font-bold text-emerald-950 hover:bg-emerald-50 focus-visible:outline-4 focus-visible:outline-amber-400 disabled:opacity-40";
  const otherDone = (next: NonogramSize) => {
    if (next === view.size) return game.completed;
    const stored = browserStorage();
    if (!stored) return false;
    const other = puzzleForDate(next, view.date);
    return loadNonogram(stored, other.id, other.solution)?.completed ?? false;
  };

  return <section className="mx-auto w-full max-w-xl" aria-label="Daily Nonogram game">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p data-testid="nonogram-date" className="text-sm font-bold text-emerald-950">{view.date} UTC · {size}×{size} · puzzle {puzzleNumber(size, view.date)} of {bankFor(size).length}</p>
      <p data-testid="nonogram-timer" className="rounded-full bg-emerald-950 px-3 py-1 font-black tabular-nums text-white">{formatDuration(game.seconds)}</p>
    </div>
    {storageError ? <p role="status" className="mb-3 rounded-xl bg-amber-100 p-3 text-sm text-amber-950">Browser storage is unavailable. You can play, but progress may not be saved.</p> : null}
    <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Puzzle size">
      {([5, 10] as const).map((option) => <button key={option} type="button" className={`${button} ${view.size === option ? "!bg-emerald-950 !text-white" : ""}`} aria-pressed={view.size === option} onClick={() => chooseSize(option)}>{option}×{option}{otherDone(option) ? " · done" : ""}</button>)}
    </div>
    <div ref={boardRef} role="grid" aria-label={`Nonogram board, ${size} by ${size}`} aria-rowcount={size + 1} aria-colcount={size + 1} className="min-w-0 touch-none select-none rounded-xl border-2 border-emerald-950 bg-emerald-950" style={{ display: "grid", gridTemplateColumns: `${size === 10 ? "4.25rem" : "3rem"} repeat(${size}, minmax(0, 1fr))` }} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
      <div role="presentation" />
      {puzzle.columns.map((clue, column) => <div key={`column-${column}`} role="columnheader" aria-colindex={column + 2} aria-label={`Column ${column + 1} clue ${clue.join(", ")}`} className="flex min-h-14 min-w-0 flex-col items-center justify-end gap-0.5 bg-[#fffdf5] px-px py-1 text-[10px] font-black leading-none text-emerald-950 sm:text-xs">{clue.map((number, index) => <span key={`${column}-${index}`}>{number}</span>)}</div>)}
      {puzzle.rows.map((clue, row) => <Fragment key={`row-${row}`}>
        <div role="rowheader" aria-rowindex={row + 2} aria-label={`Row ${row + 1} clue ${clue.join(", ")}`} className="flex min-w-0 items-center justify-end gap-0.5 bg-[#fffdf5] px-1 text-[10px] font-black text-emerald-950 sm:text-xs">{clue.map((number, index) => <span key={`${row}-${index}`}>{number}</span>)}</div>
        {Array.from({ length: size }, (_, column) => {
          const index = row * size + column;
          const mark = game.cells[index] ?? "empty";
          const label = mark === "fill" ? "filled" : mark === "cross" ? "crossed" : "empty";
          return <button key={index} id={`nonogram-cell-${index}`} type="button" role="gridcell" data-cell-index={index} aria-rowindex={row + 2} aria-colindex={column + 2} aria-selected={selected === index} aria-label={`Row ${row + 1}, column ${column + 1}, ${label}`} tabIndex={selected === index ? 0 : -1} className={`aspect-square border border-emerald-950/25 text-sm font-black focus-visible:z-10 focus-visible:outline-4 focus-visible:outline-amber-400 sm:text-base ${selected === index ? "ring-2 ring-inset ring-amber-500" : ""} ${mark === "fill" ? "bg-emerald-950 text-emerald-950" : mark === "cross" ? "bg-emerald-50 text-emerald-950" : "bg-[#fffdf5]"}`}>{mark === "cross" ? "×" : ""}</button>;
        })}
      </Fragment>)}
    </div>
    <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">Fill paints a cell. Cross marks an empty cell. Focus the board, then use arrow keys, F, X, Delete, Z, and Y. Dragging repeats the first mark.</p>
    <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Mark tool">
      <button type="button" className={`${button} ${game.tool === "fill" ? "!bg-emerald-950 !text-white" : ""}`} aria-pressed={game.tool === "fill"} onClick={() => update((state) => setTool(state, "fill"))}>Fill</button>
      <button type="button" className={`${button} ${game.tool === "cross" ? "!bg-emerald-950 !text-white" : ""}`} aria-pressed={game.tool === "cross"} onClick={() => update((state) => setTool(state, "cross"))}>Cross</button>
    </div>
    <div className="mt-2 grid grid-cols-3 gap-2">
      <button type="button" className={button} onClick={() => update((state, current) => undo(state, current.solution))} disabled={!game.history.length}>Undo</button>
      <button type="button" className={button} onClick={() => update((state, current) => redo(state, current.solution))} disabled={!game.future.length}>Redo</button>
      <button type="button" className={button} onClick={() => resetDialog.current?.showModal()}>Reset</button>
    </div>
    <p role="status" aria-live="polite" className="mt-4 min-h-12 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">{game.completed ? "Puzzle complete." : `${filled} filled · ${crossed} crossed. The picture is finished when the filled cells match the one solution.`}</p>
    <dialog ref={resetDialog} aria-labelledby="nonogram-reset-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border-0 bg-[#fffdf5] p-7 text-emerald-950 shadow-2xl backdrop:bg-emerald-950/60">
      <h2 id="nonogram-reset-title" className="text-3xl font-black tracking-[-0.04em]">Reset this puzzle?</h2>
      <p className="mt-3 leading-7 text-[var(--ink-soft)]">This clears the marks, undo history, and timer for this size. The daily picture stays the same.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className={button} onClick={() => resetDialog.current?.close()}>Cancel</button>
        <button type="button" className={`${button} !bg-emerald-950 !text-white`} onClick={() => { update((state) => resetState(state)); setClockGeneration((generation) => generation + 1); resetDialog.current?.close(); }}>Clear this puzzle</button>
      </div>
    </dialog>
    <dialog ref={completeDialog} aria-labelledby="nonogram-complete-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border-0 bg-[#fffdf5] p-7 text-emerald-950 shadow-2xl backdrop:bg-emerald-950/60">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">{size}×{size} · {view.date} UTC</p>
      <h2 id="nonogram-complete-title" className="mt-3 text-3xl font-black tracking-[-0.04em]">Puzzle complete</h2>
      <p className="mt-3 leading-7 text-[var(--ink-soft)]">Solved in {formatDuration(game.seconds)}. The next picture starts at 00:00 UTC.</p>
      <button type="button" className={`${button} mt-6 !bg-emerald-950 !text-white`} onClick={() => completeDialog.current?.close()}>View the picture</button>
    </dialog>
  </section>;
}
