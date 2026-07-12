"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  expiresAt: string;
  givens: string;
  puzzleDate: string;
  puzzleId: string;
};

export type GameResult = {
  durationSeconds: number;
  hintCount: number;
  maxHintLevel: number;
  mistakes: number;
};

type CompletionSample = {
  completions: number;
  starts: number;
  totalCompletionSeconds: number;
  totalHints: number;
};

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatCountdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
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
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [hint, setHint] = useState<SudokuHint | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [maxHintLevel, setMaxHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [serverResult, setServerResult] = useState<GameResult | null>(null);
  const [sample, setSample] = useState<CompletionSample | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [secondsToNext, setSecondsToNext] = useState(0);
  const [usedTechniques, setUsedTechniques] = useState<string[]>([]);
  const progressRef = useRef({ values, notes, seconds, mistakes, paused });
  const completionStartedRef = useRef(false);
  const restoredLocalRef = useRef(false);

  useEffect(() => {
    progressRef.current = { values, notes, seconds, mistakes, paused };
  }, [mistakes, notes, paused, seconds, values]);

  useEffect(() => {
    fetch("/api/sudoku/today")
      .then(async (response) => {
        if (!response.ok) throw new Error("Today's puzzle is unavailable.");
        return (await response.json()) as DailyPuzzle;
      })
      .then((daily) => {
        const initial = [...parseBoard(daily.givens)];
        const saved = loadSavedGame(localStorage, daily.puzzleId, daily.givens);
        restoredLocalRef.current = Boolean(saved);
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
          setMistakes(saved.mistakes);
          setHintCount(saved.hintCount);
          setMaxHintLevel(saved.maxHintLevel);
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
        const result = await response.json() as {
          boardState?: { values?: number[] };
          durationSeconds?: number | null;
          hintCount?: number;
          maxHintLevel?: 0 | 1 | 2 | 3;
          mistakes?: number;
          notes?: number[][];
          result?: GameResult | null;
          sessionId: string;
          sessionToken: string;
        };
        setSessionId(result.sessionId);
        setSessionToken(result.sessionToken);
        if (!restoredLocalRef.current && result.boardState?.values?.length === 81 && result.notes?.length === 81) {
          setValues([...result.boardState.values]);
          setNotes(result.notes.map((cell) => [...cell]));
          setSeconds(result.durationSeconds ?? 0);
          setMistakes(result.mistakes ?? 0);
          setHintCount(result.hintCount ?? 0);
          setMaxHintLevel(result.maxHintLevel ?? 0);
        }
        if (result.result) setServerResult(result.result);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load Sudoku."));
  }, []);

  const currentSave = useCallback((): SavedGame | null => {
    if (!puzzle || !hydrated || values.length !== 81 || notes.length !== 81) return null;
    return {
      version: 2,
      puzzleId: puzzle.puzzleId,
      values: [...values],
      notes: notes.map((cell) => [...cell]),
      selected,
      seconds,
      paused,
      noteMode,
      history: history.slice(-100).map((snapshot) => ({ values: [...snapshot.values], notes: snapshot.notes.map((cell) => [...cell]) })),
      future: future.slice(0, 100).map((snapshot) => ({ values: [...snapshot.values], notes: snapshot.notes.map((cell) => [...cell]) })),
      mistakes,
      hintCount,
      maxHintLevel,
      savedAt: Date.now(),
    };
  }, [future, hintCount, history, hydrated, maxHintLevel, mistakes, noteMode, notes, paused, puzzle, seconds, selected, values]);

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
  const filledCount = values.filter((value) => value !== 0).length;

  useEffect(() => {
    if (!puzzle) return;
    const update = () => setSecondsToNext(Math.max(0, Math.floor((new Date(puzzle.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [puzzle]);

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
    if (selected === null || !puzzle || paused || complete || serverResult || puzzle.givens[selected] !== "0") return;
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
    if (findConflicts(nextValues as ReturnType<typeof parseBoard>).length > 0 && !conflictCells.has(selected)) {
      setMistakes((current) => current + 1);
    }
    commit(nextValues, nextNotes);
  }, [commit, complete, conflictCells, noteMode, notes, paused, puzzle, selected, serverResult, values]);

  const erase = useCallback(() => {
    if (selected === null || !puzzle || paused || complete || serverResult || puzzle.givens[selected] !== "0") return;
    const nextValues = [...values];
    nextValues[selected] = 0;
    const nextNotes = notes.map((cell) => [...cell]);
    nextNotes[selected] = [];
    commit(nextValues, nextNotes);
  }, [commit, complete, notes, paused, puzzle, selected, serverResult, values]);

  const undo = useCallback(() => {
    const previous = history.at(-1);
    if (!previous || paused || serverResult) return;
    setFuture((current) => [{ values: [...values], notes: notes.map((cell) => [...cell]) }, ...current]);
    setValues([...previous.values]);
    setNotes(previous.notes.map((cell) => [...cell]));
    setHistory((current) => current.slice(0, -1));
  }, [history, notes, paused, serverResult, values]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next || paused || serverResult) return;
    setHistory((current) => [...current, { values: [...values], notes: notes.map((cell) => [...cell]) }]);
    setValues([...next.values]);
    setNotes(next.notes.map((cell) => [...cell]));
    setFuture((current) => current.slice(1));
  }, [future, notes, paused, serverResult, values]);

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
    setMistakes(0);
    setHintCount(0);
    setMaxHintLevel(0);
    setServerResult(null);
    setSample(null);
    setShareStatus(null);
    setUsedTechniques([]);
    completionStartedRef.current = false;
  }, [puzzle]);

  const requestHint = useCallback(async (level: 1 | 2 | 3) => {
    if (!sessionId || values.length !== 81 || paused || complete || serverResult) return;
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
      setHintCount((current) => current + 1);
      setMaxHintLevel((current) => Math.max(current, level) as 0 | 1 | 2 | 3);
      setUsedTechniques((current) => current.includes(result.hint!.title) ? current : [...current, result.hint!.title]);
    } catch (cause) {
      setHintError(cause instanceof Error ? cause.message : "Hint unavailable");
    } finally {
      setHintLoading(false);
    }
  }, [complete, paused, serverResult, sessionId, values]);

  const saveProgress = useCallback(async () => {
    const current = progressRef.current;
    if (!sessionToken || current.values.length !== 81 || current.notes.length !== 81 || serverResult) return;
    await fetch("/api/sudoku/session/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: sessionToken, board: current.values.join(""), notes: current.notes, elapsedSeconds: current.seconds, mistakes: current.mistakes, paused: current.paused }),
    });
  }, [serverResult, sessionToken]);

  useEffect(() => {
    if (!sessionToken || !hydrated) return;
    const timeout = window.setTimeout(() => void saveProgress(), 700);
    return () => window.clearTimeout(timeout);
  }, [history.length, hydrated, noteMode, paused, saveProgress, sessionToken]);

  useEffect(() => {
    if (!sessionToken || !hydrated || paused || complete) return;
    const interval = window.setInterval(() => void saveProgress(), 15_000);
    return () => window.clearInterval(interval);
  }, [complete, hydrated, paused, saveProgress, sessionToken]);

  useEffect(() => {
    if (!complete || !sessionToken || serverResult || completionStartedRef.current) return;
    completionStartedRef.current = true;
    fetch("/api/sudoku/session/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: sessionToken, board: values.join(""), notes, elapsedSeconds: Math.max(1, seconds), mistakes }),
    }).then(async (response) => {
      const payload = await response.json() as { error?: string; result?: GameResult; sample?: CompletionSample | null };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "Completion could not be verified");
      setServerResult(payload.result);
      setSample(payload.sample ?? null);
    }).catch((cause: unknown) => {
      completionStartedRef.current = false;
      setError(cause instanceof Error ? cause.message : "Completion could not be verified");
    });
  }, [complete, mistakes, notes, seconds, serverResult, sessionToken, values]);

  const shareResult = useCallback(async () => {
    if (!puzzle || !serverResult) return;
    const text = [
      "PuzzGrind Daily Sudoku",
      puzzle.puzzleDate,
      "Medium",
      `⏱ ${formatTime(serverResult.durationSeconds)}`,
      `💡 ${serverResult.hintCount} hint${serverResult.hintCount === 1 ? "" : "s"}`,
      `❌ ${serverResult.mistakes} mistake${serverResult.mistakes === 1 ? "" : "s"}`,
      "https://puzzgrind.com/sudoku",
    ].join("\n");
    try {
      const usedNativeShare = typeof navigator.share === "function";
      if (usedNativeShare) await navigator.share({ title: "PuzzGrind Daily Sudoku", text, url: "https://puzzgrind.com/sudoku" });
      else await navigator.clipboard.writeText(text);
      setShareStatus(usedNativeShare ? "Shared" : "Copied to clipboard");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      await navigator.clipboard.writeText(text);
      setShareStatus("Copied to clipboard");
    }
  }, [puzzle, serverResult]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (serverResult) return;
      if (/^[1-9]$/.test(event.key)) inputNumber(Number(event.key));
      if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") erase();
      if (event.key.toLowerCase() === "n") setNoteMode((current) => !current);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [erase, inputNumber, serverResult, undo]);

  if (error) return <div className="rounded-3xl bg-red-100 p-6 font-bold text-red-900">{error}</div>;
  if (!puzzle) return <div className="rounded-3xl bg-white/70 p-8 text-center font-bold">Loading today&apos;s puzzle…</div>;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,36rem)_18rem]">
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white">Medium</span><span className="ml-3 text-sm text-[var(--ink-soft)]">{puzzle.puzzleDate} UTC</span></div>
          <div className="flex items-center gap-3"><span className="font-mono text-lg font-black">{formatTime(seconds)}</span><button className="rounded-full border border-emerald-950/20 px-4 py-2 font-bold disabled:opacity-40" disabled={Boolean(serverResult)} onClick={() => setPaused((current) => !current)}>{paused ? "Resume" : "Pause"}</button></div>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-white/70 p-2"><strong className="block text-base">{filledCount}/81</strong>Filled</div><div className="rounded-xl bg-white/70 p-2"><strong className="block text-base">{mistakes}</strong>Mistakes</div><div className="rounded-xl bg-white/70 p-2"><strong className="block text-base">{hintCount}</strong>Hints</div></div>
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
            return <button aria-label={`Row ${row + 1}, column ${column + 1}${value ? `, ${value}` : ", empty"}`} aria-selected={selectedCell} className={classes} disabled={paused || Boolean(serverResult)} key={index} onClick={() => setSelected(index)} role="gridcell">
              {value || notes[index].length === 0 ? (value || "") : <span className="grid h-full w-full grid-cols-3 text-[9px] leading-none sm:text-xs">{Array.from({ length: 9 }, (_, candidate) => <span className="grid place-items-center" key={candidate}>{notes[index].includes(candidate + 1) ? candidate + 1 : ""}</span>)}</span>}
            </button>;
          })}
          {paused && <div className="absolute inset-0 z-20 grid place-items-center bg-[#f6f3ea]/95"><p className="text-2xl font-black">Paused</p></div>}
        </div>
        {complete && !serverResult && <div className="mt-4 rounded-2xl bg-emerald-100 p-5 text-center"><p className="text-xl font-black">Checking your solution…</p><p className="mt-1 text-sm">The server is verifying the final board.</p></div>}
        {conflictCells.size > 0 && <p className="mt-3 font-bold text-red-800" role="alert">Conflict detected — cells marked with ! repeat a number.</p>}
      </section>

      <aside className="space-y-4">
        {serverResult && <section className="overflow-hidden rounded-3xl bg-emerald-950 text-white shadow-xl shadow-emerald-950/15">
          <div className="bg-[radial-gradient(circle_at_top_right,_rgba(219,255,110,.45),_transparent_45%)] p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Verified result</p><h2 className="mt-2 text-3xl font-black">Puzzle complete</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-white/10 p-3"><span className="block text-white/60">Time</span><strong className="text-lg">{formatTime(serverResult.durationSeconds)}</strong></div><div className="rounded-xl bg-white/10 p-3"><span className="block text-white/60">Mistakes</span><strong className="text-lg">{serverResult.mistakes}</strong></div><div className="rounded-xl bg-white/10 p-3"><span className="block text-white/60">Hints</span><strong className="text-lg">{serverResult.hintCount}</strong></div><div className="rounded-xl bg-white/10 p-3"><span className="block text-white/60">Best hint</span><strong className="text-lg">{serverResult.maxHintLevel ? `L${serverResult.maxHintLevel}` : "—"}</strong></div></div>
            {serverResult.hintCount === 0 && <p className="mt-4 rounded-full bg-[var(--accent)] px-4 py-2 text-center text-sm font-black text-emerald-950">No Hint</p>}
            {usedTechniques.length > 0 && <p className="mt-4 text-sm text-white/70">Techniques: {usedTechniques.join(", ")}</p>}
            <button className="mt-5 w-full rounded-xl bg-white px-4 py-3 font-black text-emerald-950" onClick={shareResult}>Share result</button>{shareStatus && <p className="mt-2 text-center text-xs text-white/70">{shareStatus}</p>}
          </div>
          <div className="border-t border-white/10 p-5 text-sm text-white/70">{sample && sample.completions >= 20 ? <><p>Today: {Math.round(sample.completions / Math.max(1, sample.starts) * 100)}% completion rate</p><p>Average time: {formatTime(Math.round(sample.totalCompletionSeconds / sample.completions))}</p></> : <p>Today&apos;s sample is still growing.</p>}<p className="mt-3 font-mono text-white">Next puzzle in {formatCountdown(secondsToNext)}</p></div>
        </section>}
        <section className="rounded-2xl border border-emerald-950/15 bg-white/75 p-4">
          {hintError && <p className="mb-3 rounded-lg bg-red-100 p-3 text-sm font-bold text-red-900" role="alert">{hintError.replaceAll("_", " ")}</p>}
          {hint ? <>
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Level {hint.level} · {hint.title}</p><button className="text-sm font-bold text-[var(--ink-soft)]" onClick={() => setHint(null)}>Close</button></div>
            <p className="mt-3 text-sm leading-6">{hint.explanation}</p>
            {hint.level < 3 && <button className="mt-4 w-full rounded-xl bg-sky-700 px-4 py-3 font-black text-white disabled:opacity-50" disabled={hintLoading || Boolean(serverResult)} onClick={() => requestHint((hint.level + 1) as 2 | 3)}>{hintLoading ? "Thinking…" : "Explain more"}</button>}
          </> : <>
            <p className="font-black">Need a nudge?</p><p className="mt-1 text-sm leading-5 text-[var(--ink-soft)]">Hints explain the logic in three steps and never fill the board for you.</p>
            <button className="mt-3 w-full rounded-xl bg-sky-700 px-4 py-3 font-black text-white disabled:opacity-50" disabled={!sessionId || hintLoading || Boolean(serverResult)} onClick={() => requestHint(1)}>{hintLoading ? "Finding a hint…" : "Get a hint"}</button>
          </>}
        </section>
        <div className="grid grid-cols-5 gap-2 lg:grid-cols-3">{Array.from({ length: 9 }, (_, offset) => <button className="min-h-12 rounded-xl bg-emerald-950 text-xl font-black text-white disabled:opacity-40" disabled={Boolean(serverResult)} key={offset} onClick={() => inputNumber(offset + 1)}>{offset + 1}</button>)}</div>
        <div className="grid grid-cols-2 gap-2">
          <button aria-pressed={noteMode} className={`min-h-12 rounded-xl border font-black disabled:opacity-40 ${noteMode ? "border-amber-500 bg-amber-200" : "border-emerald-950/20 bg-white/70"}`} disabled={Boolean(serverResult)} onClick={() => setNoteMode((current) => !current)}>Notes {noteMode ? "On" : "Off"}</button>
          <button className="min-h-12 rounded-xl border border-emerald-950/20 bg-white/70 font-black disabled:opacity-40" disabled={Boolean(serverResult)} onClick={erase}>Erase</button>
          <button className="min-h-12 rounded-xl border border-emerald-950/20 bg-white/70 font-black disabled:opacity-40" disabled={!history.length || Boolean(serverResult)} onClick={undo}>Undo</button>
          <button className="min-h-12 rounded-xl border border-emerald-950/20 bg-white/70 font-black disabled:opacity-40" disabled={!future.length || Boolean(serverResult)} onClick={redo}>Redo</button>
          <button className="col-span-2 min-h-12 rounded-xl border border-red-900/20 bg-red-50 font-black text-red-900 disabled:cursor-not-allowed disabled:opacity-40" disabled={Boolean(serverResult)} onClick={restart}>{serverResult ? "Completed" : "Restart puzzle"}</button>
        </div>
        <p className="text-sm leading-6 text-[var(--ink-soft)]">Keyboard: 1–9 to enter, N for notes, Delete to erase, Ctrl/⌘+Z to undo.</p>
      </aside>
    </div>
  );
}
