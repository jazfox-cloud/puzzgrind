"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { findConflicts, isCompleteValidBoard, parseBoard } from "@/lib/sudoku";
import {
  clearSavedGame,
  getOrCreateAnonymousId,
  loadSavedGame,
  saveGame,
} from "@/lib/sudoku/storage";
import type { GameSnapshot, SavedGame } from "@/lib/sudoku/storage";
import type { SudokuHint } from "@/lib/sudoku/hints";

type DailyPuzzle = {
  difficulty: "medium";
  givens: string;
  puzzleDate: string;
  puzzleId: string;
};

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SudokuGame() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [values, setValues] = useState<number[]>([]);
  const [notes, setNotes] = useState<number[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [history, setHistory] = useState<GameSnapshot[]>([]);
  const [future, setFuture] = useState<GameSnapshot[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hint, setHint] = useState<SudokuHint | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sudoku/today")
      .then(async (response) => {
        if (!response.ok) throw new Error("Today's puzzle is unavailable.");
        return (await response.json()) as DailyPuzzle;
      })
      .then((daily) => {
        const initial = [...parseBoard(daily.givens)];
        const saved = loadSavedGame(localStorage, daily.puzzleId, daily.givens);
        setPuzzle(daily);
        if (saved) {
          setValues([...saved.values]);
          setNotes(saved.notes.map((cell) => [...cell]));
          setSelected(saved.selected);
          setSeconds(saved.seconds);
          setPaused(saved.paused);
          setNoteMode(saved.noteMode);
          setHistory(saved.history.map((snapshot) => ({ values: [...snapshot.values], notes: snapshot.notes.map((cell) => [...cell]) })));
          setFuture(saved.future.map((snapshot) => ({ values: [...snapshot.values], notes: snapshot.notes.map((cell) => [...cell]) })));
        } else {
          setValues(initial);
          setNotes(Array.from({ length: 81 }, () => []));
        }
        setHydrated(true);
        const anonymousId = getOrCreateAnonymousId(localStorage, () => crypto.randomUUID());
        return fetch("/api/sudoku/session/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ anonymousId }),
        });
      })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to start your game session.");
        const result = await response.json() as { sessionId: string };
        setSessionId(result.sessionId);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load Sudoku."));
  }, []);

  const currentSave = useCallback((): SavedGame | null => {
    if (!puzzle || !hydrated || values.length !== 81 || notes.length !== 81) return null;
    return {
      version: 1,
      puzzleId: puzzle.puzzleId,
      values: [...values],
      notes: notes.map((cell) => [...cell]),
      selected,
      seconds,
      paused,
      noteMode,
      history: history.slice(-100).map((snapshot) => ({ values: [...snapshot.values], notes: snapshot.notes.map((cell) => [...cell]) })),
      future: future.slice(0, 100).map((snapshot) => ({ values: [...snapshot.values], notes: snapshot.notes.map((cell) => [...cell]) })),
      savedAt: Date.now(),
    };
  }, [future, history, hydrated, noteMode, notes, paused, puzzle, seconds, selected, values]);

  useEffect(() => {
    const game = currentSave();
    if (game) saveGame(localStorage, game);
  }, [currentSave]);

  useEffect(() => {
    const persist = () => {
      const game = currentSave();
      if (game) saveGame(localStorage, game);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentSave]);

  const conflictCells = useMemo(() => {
    if (values.length !== 81) return new Set<number>();
    return new Set(findConflicts(values as ReturnType<typeof parseBoard>).flatMap((conflict) => conflict.cells));
  }, [values]);
  const complete = values.length === 81 && isCompleteValidBoard(values as ReturnType<typeof parseBoard>);

  useEffect(() => {
    if (!puzzle || paused || complete) return;
    const timer = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [complete, paused, puzzle]);

  const commit = useCallback((nextValues: number[], nextNotes: number[][]) => {
    setHistory((current) => [...current, { values: [...values], notes: notes.map((cell) => [...cell]) }]);
    setFuture([]);
    setValues(nextValues);
    setNotes(nextNotes);
  }, [notes, values]);

  const inputNumber = useCallback((number: number) => {
    if (selected === null || !puzzle || paused || complete || puzzle.givens[selected] !== "0") return;
    if (noteMode) {
      const nextNotes = notes.map((cell) => [...cell]);
      nextNotes[selected] = nextNotes[selected].includes(number)
        ? nextNotes[selected].filter((candidate) => candidate !== number)
        : [...nextNotes[selected], number].sort();
      commit([...values], nextNotes);
      return;
    }
    const nextValues = [...values];
    nextValues[selected] = number;
    const nextNotes = notes.map((cell) => [...cell]);
    nextNotes[selected] = [];
    commit(nextValues, nextNotes);
  }, [commit, complete, noteMode, notes, paused, puzzle, selected, values]);

  const erase = useCallback(() => {
    if (selected === null || !puzzle || paused || complete || puzzle.givens[selected] !== "0") return;
    const nextValues = [...values];
    nextValues[selected] = 0;
    const nextNotes = notes.map((cell) => [...cell]);
    nextNotes[selected] = [];
    commit(nextValues, nextNotes);
  }, [commit, complete, notes, paused, puzzle, selected, values]);

  const undo = useCallback(() => {
    const previous = history.at(-1);
    if (!previous || paused) return;
    setFuture((current) => [{ values: [...values], notes: notes.map((cell) => [...cell]) }, ...current]);
    setValues([...previous.values]);
    setNotes(previous.notes.map((cell) => [...cell]));
    setHistory((current) => current.slice(0, -1));
  }, [history, notes, paused, values]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next || paused) return;
    setHistory((current) => [...current, { values: [...values], notes: notes.map((cell) => [...cell]) }]);
    setValues([...next.values]);
    setNotes(next.notes.map((cell) => [...cell]));
    setFuture((current) => current.slice(1));
  }, [future, notes, paused, values]);

  const restart = useCallback(() => {
    if (!puzzle || !window.confirm("Restart today's puzzle? Your current progress will be cleared.")) return;
    clearSavedGame(localStorage, puzzle.puzzleId);
    setValues([...parseBoard(puzzle.givens)]);
    setNotes(Array.from({ length: 81 }, () => []));
    setSelected(null);
    setNoteMode(false);
    setHistory([]);
    setFuture([]);
    setSeconds(0);
    setPaused(false);
    setHint(null);
  }, [puzzle]);

  const requestHint = useCallback(async (level: 1 | 2 | 3) => {
    if (!sessionId || values.length !== 81 || paused || complete) return;
    setHintLoading(true);
    setHintError(null);
    try {
      const response = await fetch("/api/sudoku/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, board: values.join(""), level }),
      });
      const result = await response.json() as { error?: string; hint?: SudokuHint };
      if (!response.ok || !result.hint) throw new Error(result.error ?? "Hint unavailable");
      setHint(result.hint);
      setSelected(result.hint.targetCells[0] ?? null);
    } catch (cause) {
      setHintError(cause instanceof Error ? cause.message : "Hint unavailable");
    } finally {
      setHintLoading(false);
    }
  }, [complete, paused, sessionId, values]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^[1-9]$/.test(event.key)) inputNumber(Number(event.key));
      if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") erase();
      if (event.key.toLowerCase() === "n") setNoteMode((current) => !current);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [erase, inputNumber, undo]);

  if (error) return <div className="rounded-3xl bg-red-100 p-6 font-bold text-red-900">{error}</div>;
  if (!puzzle) return <div className="rounded-3xl bg-white/70 p-8 text-center font-bold">Loading today&apos;s puzzle…</div>;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,36rem)_18rem]">
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><span className="font-black">Medium</span><span className="ml-3 text-sm text-[var(--ink-soft)]">{puzzle.puzzleDate} UTC</span></div>
          <div className="flex items-center gap-3"><span className="font-mono text-lg font-black">{formatTime(seconds)}</span><button className="rounded-full border border-emerald-950/20 px-4 py-2 font-bold" onClick={() => setPaused((current) => !current)}>{paused ? "Resume" : "Pause"}</button></div>
        </div>
        <div className="relative grid aspect-square grid-cols-9 overflow-hidden rounded-xl border-2 border-emerald-950 bg-emerald-950" role="grid" aria-label="Daily Sudoku board">
          {values.map((value, index) => {
            const given = puzzle.givens[index] !== "0";
            const row = Math.floor(index / 9);
            const column = index % 9;
            const selectedCell = selected === index;
            const classes = [
              "relative grid place-items-center border-emerald-950/20 bg-[#fffdf5] text-lg sm:text-2xl",
              column % 3 === 2 && column !== 8 ? "border-r-2 border-r-emerald-950" : "border-r",
              row % 3 === 2 && row !== 8 ? "border-b-2 border-b-emerald-950" : "border-b",
              given ? "font-black text-emerald-950" : "font-bold text-emerald-700",
              selectedCell ? "z-10 outline-4 outline-amber-400 outline" : "",
              conflictCells.has(index) ? "bg-red-100 text-red-800 after:absolute after:right-1 after:top-0 after:content-['!']" : "",
              hint?.targetCells.includes(index) ? "bg-sky-100 ring-2 ring-inset ring-sky-500" : "",
            ].join(" ");
            return <button aria-label={`Row ${row + 1}, column ${column + 1}${value ? `, ${value}` : ", empty"}`} aria-selected={selectedCell} className={classes} disabled={paused} key={index} onClick={() => setSelected(index)} role="gridcell">
              {value || notes[index].length === 0 ? (value || "") : <span className="grid h-full w-full grid-cols-3 text-[9px] leading-none sm:text-xs">{Array.from({ length: 9 }, (_, candidate) => <span className="grid place-items-center" key={candidate}>{notes[index].includes(candidate + 1) ? candidate + 1 : ""}</span>)}</span>}
            </button>;
          })}
          {paused && <div className="absolute inset-0 z-20 grid place-items-center bg-[#f6f3ea]/95"><p className="text-2xl font-black">Paused</p></div>}
        </div>
        {complete && <div className="mt-4 rounded-2xl bg-emerald-100 p-5 text-center"><p className="text-xl font-black">Puzzle complete!</p><p className="mt-1 text-sm">Time {formatTime(seconds)} · No answer was revealed.</p></div>}
        {conflictCells.size > 0 && <p className="mt-3 font-bold text-red-800" role="alert">Conflict detected — cells marked with ! repeat a number.</p>}
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-emerald-950/15 bg-white/75 p-4">
          {hintError && <p className="mb-3 rounded-lg bg-red-100 p-3 text-sm font-bold text-red-900" role="alert">{hintError.replaceAll("_", " ")}</p>}
          {hint ? <>
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Level {hint.level} · {hint.title}</p><button className="text-sm font-bold text-[var(--ink-soft)]" onClick={() => setHint(null)}>Close</button></div>
            <p className="mt-3 text-sm leading-6">{hint.explanation}</p>
            {hint.level < 3 && <button className="mt-4 w-full rounded-xl bg-sky-700 px-4 py-3 font-black text-white disabled:opacity-50" disabled={hintLoading} onClick={() => requestHint((hint.level + 1) as 2 | 3)}>{hintLoading ? "Thinking…" : "Explain more"}</button>}
          </> : <>
            <p className="font-black">Need a nudge?</p><p className="mt-1 text-sm leading-5 text-[var(--ink-soft)]">Hints explain the logic in three steps and never fill the board for you.</p>
            <button className="mt-3 w-full rounded-xl bg-sky-700 px-4 py-3 font-black text-white disabled:opacity-50" disabled={!sessionId || hintLoading} onClick={() => requestHint(1)}>{hintLoading ? "Finding a hint…" : "Get a hint"}</button>
          </>}
        </section>
        <div className="grid grid-cols-5 gap-2 lg:grid-cols-3">{Array.from({ length: 9 }, (_, offset) => <button className="min-h-12 rounded-xl bg-emerald-950 text-xl font-black text-white" key={offset} onClick={() => inputNumber(offset + 1)}>{offset + 1}</button>)}</div>
        <div className="grid grid-cols-2 gap-2">
          <button aria-pressed={noteMode} className={`min-h-12 rounded-xl border font-black ${noteMode ? "border-amber-500 bg-amber-200" : "border-emerald-950/20 bg-white/70"}`} onClick={() => setNoteMode((current) => !current)}>Notes {noteMode ? "On" : "Off"}</button>
          <button className="min-h-12 rounded-xl border border-emerald-950/20 bg-white/70 font-black" onClick={erase}>Erase</button>
          <button className="min-h-12 rounded-xl border border-emerald-950/20 bg-white/70 font-black disabled:opacity-40" disabled={!history.length} onClick={undo}>Undo</button>
          <button className="min-h-12 rounded-xl border border-emerald-950/20 bg-white/70 font-black disabled:opacity-40" disabled={!future.length} onClick={redo}>Redo</button>
          <button className="col-span-2 min-h-12 rounded-xl border border-red-900/20 bg-red-50 font-black text-red-900" onClick={restart}>Restart puzzle</button>
        </div>
        <p className="text-sm leading-6 text-[var(--ink-soft)]">Keyboard: 1–9 to enter, N for notes, Delete to erase, Ctrl/⌘+Z to undo.</p>
      </aside>
    </div>
  );
}
