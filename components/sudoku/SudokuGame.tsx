"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CompletionDialog } from "@/components/sudoku/CompletionDialog";
import { DailyLeaderboard, LeaderboardJoin } from "@/components/sudoku/DailyLeaderboard";
import { sudokuAnalytics } from "@/lib/analytics/events";
import { findConflicts, isCompleteValidBoard, parseBoard } from "@/lib/sudoku";
import {
  buildResultShareText,
  copyResultText,
  EMPTY_SUDOKU_STATS,
  loadLocalSudokuStats,
  recordCompletionFeedback,
  recordLocalCompletion,
  secondsUntilNextUtcMidnight,
  shareResultText,
} from "@/lib/sudoku/engagement";
import type { CompletionFeedback, LocalSudokuStats } from "@/lib/sudoku/engagement";
import { explainStep, hintHighlightCells } from "@/lib/sudoku/hints";
import type { SudokuHint } from "@/lib/sudoku/hints";
import {
  DEFAULT_LEADERBOARD_NAME,
  loadLeaderboardDisplayName,
  saveLeaderboardDisplayName,
} from "@/lib/sudoku/leaderboard";
import type { LeaderboardSnapshot } from "@/lib/sudoku/leaderboard";
import {
  clearSavedGame,
  getOrCreateAnonymousId,
  loadSavedGame,
  saveGame,
} from "@/lib/sudoku/storage";
import type { GameSnapshot, SavedGame } from "@/lib/sudoku/storage";

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

const PUZZLE_LOAD_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = PUZZLE_LOAD_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function boardFingerprint(values: number[], notes: number[][]): string {
  return `${values.join("")}|${notes.map((cell) => cell.join("")).join(".")}`;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [hint, setHint] = useState<SudokuHint | null>(null);
  const [hintFingerprint, setHintFingerprint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [maxHintLevel, setMaxHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [serverResult, setServerResult] = useState<GameResult | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [localStats, setLocalStats] = useState<LocalSudokuStats>({ ...EMPTY_SUDOKU_STATS, feedbackByPuzzleId: {} });
  const [feedback, setFeedback] = useState<CompletionFeedback | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [secondsToNext, setSecondsToNext] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardSnapshot | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false);
  const [leaderboardAttempt, setLeaderboardAttempt] = useState(0);
  const [joinStarted, setJoinStarted] = useState(false);
  const [joiningLeaderboard, setJoiningLeaderboard] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(DEFAULT_LEADERBOARD_NAME);
  const progressRef = useRef({ values, notes, seconds, mistakes, paused });
  const completionStartedRef = useRef(false);
  const acceptedPuzzleRef = useRef<string | null>(null);
  const restoredLocalRef = useRef(false);
  const leaderboardViewedRef = useRef<string | null>(null);

  const acceptVerifiedResult = useCallback((result: GameResult, daily: DailyPuzzle) => {
    setServerResult(result);
    setCompletionOpen(true);
    setShareStatus(null);
    completionStartedRef.current = true;
    if (acceptedPuzzleRef.current === daily.puzzleId) return;
    acceptedPuzzleRef.current = daily.puzzleId;
    const recorded = recordLocalCompletion(localStorage, {
      completionTime: result.durationSeconds,
      hintsUsed: result.hintCount,
      puzzleDate: daily.puzzleDate,
      puzzleId: daily.puzzleId,
    });
    setLocalStats(recorded.stats);
    setFeedback(recorded.stats.feedbackByPuzzleId[daily.puzzleId] ?? null);
    if (recorded.counted) {
      sudokuAnalytics.puzzleCompleted({
        duration_seconds: result.durationSeconds,
        hints_used: result.hintCount,
        streak: recorded.stats.currentStreak,
      });
    }
  }, []);

  useEffect(() => {
    progressRef.current = { values, notes, seconds, mistakes, paused };
  }, [mistakes, notes, paused, seconds, values]);

  useEffect(() => {
    let active = true;

    async function loadPuzzle() {
      setLoadError(null);
      setSessionWarning(null);
      try {
        const response = await fetchWithTimeout("/api/sudoku/today");
        if (!response.ok) throw new Error("Today's puzzle is unavailable right now.");
        const daily = (await response.json()) as DailyPuzzle;
        const initial = [...parseBoard(daily.givens)];
        if (!active) return;
        const saved = loadSavedGame(localStorage, daily.puzzleId, daily.givens);
        const stats = loadLocalSudokuStats(localStorage);
        setDisplayName(loadLeaderboardDisplayName(localStorage));
        restoredLocalRef.current = Boolean(saved);
        setPuzzle(daily);
        setLocalStats(stats);
        setFeedback(stats.feedbackByPuzzleId[daily.puzzleId] ?? null);
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
          if (saved.completedResult) acceptVerifiedResult(saved.completedResult, daily);
        } else {
          setValues(initial);
          setNotes(Array.from({ length: 81 }, () => []));
        }
        setHydrated(true);

        const anonymousId = getOrCreateAnonymousId(localStorage, () => crypto.randomUUID());
        try {
          const sessionResponse = await fetchWithTimeout("/api/sudoku/session/start", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ anonymousId }),
          });
          if (!sessionResponse.ok) throw new Error("Unable to start your game session.");
          const result = await sessionResponse.json() as {
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
          if (!active) return;
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
          if (result.result) acceptVerifiedResult(result.result, daily);
        } catch {
          if (active) setSessionWarning("You can keep playing. Hints and server sync are temporarily unavailable.");
        }
      } catch (cause) {
        if (!active) return;
        const timedOut = cause instanceof DOMException && cause.name === "AbortError";
        setLoadError(timedOut
          ? "The puzzle took too long to load. Check your connection and try again."
          : cause instanceof Error ? cause.message : "Unable to load today's Sudoku.");
      }
    }

    void loadPuzzle();
    return () => {
      active = false;
    };
  }, [acceptVerifiedResult, loadAttempt]);

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
      completedResult: serverResult,
      savedAt: Date.now(),
    };
  }, [future, hintCount, history, hydrated, maxHintLevel, mistakes, noteMode, notes, paused, puzzle, seconds, selected, serverResult, values]);

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
    const update = () => setSecondsToNext(secondsUntilNextUtcMidnight());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [puzzle]);

  useEffect(() => {
    if (!puzzle) return;
    const puzzleId = puzzle.puzzleId;
    let active = true;
    async function loadLeaderboard() {
      setLeaderboardLoading(true);
      setLeaderboardError(null);
      try {
        const response = await fetch(`/api/sudoku/leaderboard?limit=${leaderboardExpanded ? "20" : "10"}`, {
          headers: sessionToken ? { authorization: `Bearer ${sessionToken}` } : undefined,
        });
        const payload = await response.json() as LeaderboardSnapshot & { error?: string };
        if (!response.ok || payload.error) throw new Error("Today’s leaderboard is unavailable right now.");
        if (!active) return;
        setLeaderboard(payload);
        if (payload.ownRank !== null) setJoinStarted(true);
        if (leaderboardViewedRef.current !== puzzleId) {
          leaderboardViewedRef.current = puzzleId;
          sudokuAnalytics.leaderboardViewed();
        }
      } catch (cause) {
        if (active) setLeaderboardError(cause instanceof Error ? cause.message : "Unable to load today’s leaderboard.");
      } finally {
        if (active) setLeaderboardLoading(false);
      }
    }
    void loadLeaderboard();
    return () => { active = false; };
  }, [leaderboardAttempt, leaderboardExpanded, puzzle, sessionToken]);

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
    setHint(null);
    setHintFingerprint(null);
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
    setHint(null);
    setHintFingerprint(null);
  }, [history, notes, paused, serverResult, values]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next || paused || serverResult) return;
    setHistory((current) => [...current, { values: [...values], notes: notes.map((cell) => [...cell]) }]);
    setValues([...next.values]);
    setNotes(next.notes.map((cell) => [...cell]));
    setFuture((current) => current.slice(1));
    setHint(null);
    setHintFingerprint(null);
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
    setHintFingerprint(null);
    setMistakes(0);
    setHintCount(0);
    setMaxHintLevel(0);
    setServerResult(null);
    setCompletionOpen(false);
    setFeedback(null);
    setShareStatus(null);
    completionStartedRef.current = false;
  }, [puzzle]);

  const requestHint = useCallback(async () => {
    if (!sessionId || !sessionToken || values.length !== 81 || paused || complete || serverResult) return;
    if (conflictCells.size > 0) {
      setHintError("There’s a conflict on the board. Fix the red ! cells before asking for another hint.");
      return;
    }
    setHintLoading(true);
    setHintError(null);
    try {
      const response = await fetch("/api/sudoku/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, sessionToken, board: values.join(""), level: 1 }),
      });
      const result = await response.json() as { error?: string; hint?: SudokuHint };
      if (!response.ok || !result.hint) {
        const message = result.error === "invalid_board"
          ? "There’s a conflict on the board. Fix the red ! cells before asking for another hint."
          : "A hint isn’t available for this board yet. Check your entries and try again.";
        throw new Error(message);
      }
      setHint(result.hint);
      setHintFingerprint(boardFingerprint(values, notes));
      setHintCount((current) => current + 1);
      setMaxHintLevel((current) => Math.max(current, 1) as 0 | 1 | 2 | 3);
      sudokuAnalytics.hintOpened({ technique: result.hint.title });
      sudokuAnalytics.hintLevelViewed({ hint_level: 1, technique: result.hint.title });
    } catch (cause) {
      setHintError(cause instanceof Error ? cause.message : "Hint unavailable");
    } finally {
      setHintLoading(false);
    }
  }, [complete, conflictCells, notes, paused, serverResult, sessionId, sessionToken, values]);

  const revealHintLevel = useCallback(() => {
    if (!hint || hint.level >= 3) return;
    const nextLevel = (hint.level + 1) as 2 | 3;
    const expanded = explainStep(hint, nextLevel);
    setHint(expanded);
    setMaxHintLevel((current) => Math.max(current, nextLevel) as 0 | 1 | 2 | 3);
    if (nextLevel === 3) setSelected(expanded.targetCells[0] ?? null);
    sudokuAnalytics.hintLevelViewed({ hint_level: nextLevel, technique: expanded.title });
  }, [hint]);

  const applyHintMove = useCallback(() => {
    if (!hint || hint.level !== 3 || hint.targetCells.length !== 1 || !hintFingerprint) return;
    if (boardFingerprint(values, notes) !== hintFingerprint) {
      setHint(null);
      setHintFingerprint(null);
      setHintError("That hint expired because the board changed. Ask for a new hint.");
      return;
    }
    const target = hint.targetCells[0];
    if (values[target] !== 0) return;
    const nextValues = [...values];
    const nextNotes = notes.map((cell) => [...cell]);
    nextValues[target] = hint.candidate;
    nextNotes[target] = [];
    commit(nextValues, nextNotes);
    setSelected(target);
    setHint(null);
    setHintFingerprint(null);
    sudokuAnalytics.hintApplied({ technique: hint.title });
  }, [commit, hint, hintFingerprint, notes, values]);

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
    if (!complete || !puzzle || !sessionToken || serverResult || completionStartedRef.current) return;
    const daily = puzzle;
    completionStartedRef.current = true;
    fetch("/api/sudoku/session/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: sessionToken, board: values.join(""), notes, elapsedSeconds: Math.max(1, seconds), mistakes }),
    }).then(async (response) => {
      const payload = await response.json() as { error?: string; result?: GameResult };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "Completion could not be verified");
      acceptVerifiedResult(payload.result, daily);
    }).catch((cause: unknown) => {
      completionStartedRef.current = false;
      setGameError(cause instanceof Error ? cause.message : "Completion could not be verified");
    });
  }, [acceptVerifiedResult, complete, mistakes, notes, puzzle, seconds, serverResult, sessionToken, values]);

  const shareResult = useCallback(async () => {
    if (!serverResult) return;
    const text = buildResultShareText({
      currentStreak: localStats.currentStreak,
      durationSeconds: serverResult.durationSeconds,
      hintsUsed: serverResult.hintCount,
    });
    const outcome = await shareResultText({
      clipboard: navigator.clipboard ? { writeText: (value) => navigator.clipboard.writeText(value) } : undefined,
      share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
    }, text);
    if (outcome === "shared") {
      setShareStatus("Result shared.");
      sudokuAnalytics.resultShared();
    } else if (outcome === "copied") {
      setShareStatus("Result copied to clipboard.");
      sudokuAnalytics.resultCopied({ source: "share_fallback" });
    } else if (outcome === "canceled") setShareStatus("Share canceled.");
    else setShareStatus("Unable to share or copy the result.");
  }, [localStats.currentStreak, serverResult]);

  const copyResult = useCallback(async () => {
    if (!serverResult) return;
    const text = buildResultShareText({
      currentStreak: localStats.currentStreak,
      durationSeconds: serverResult.durationSeconds,
      hintsUsed: serverResult.hintCount,
    });
    const outcome = await copyResultText({
      clipboard: navigator.clipboard ? { writeText: (value) => navigator.clipboard.writeText(value) } : undefined,
    }, text);
    setShareStatus(outcome === "copied" ? "Result copied to clipboard." : "Unable to copy the result.");
    if (outcome === "copied") sudokuAnalytics.resultCopied({ source: "copy_button" });
  }, [localStats.currentStreak, serverResult]);

  const chooseFeedback = useCallback((choice: CompletionFeedback) => {
    if (!puzzle) return;
    const firstSelection = feedback === null;
    const recorded = recordCompletionFeedback(localStorage, puzzle.puzzleId, choice);
    const nextStats = recorded.persisted ? recorded.stats : {
      ...localStats,
      feedbackByPuzzleId: { ...localStats.feedbackByPuzzleId, [puzzle.puzzleId]: choice },
    };
    setFeedback(choice);
    setLocalStats(nextStats);
    if (firstSelection) sudokuAnalytics.completionFeedback({ rating: choice });
  }, [feedback, localStats, puzzle]);

  const startLeaderboardJoin = useCallback(() => {
    setJoinStarted(true);
    setJoinError(null);
    sudokuAnalytics.leaderboardJoinStarted();
  }, []);

  const submitLeaderboard = useCallback(async () => {
    if (!sessionToken || !serverResult) return;
    setJoiningLeaderboard(true);
    setJoinError(null);
    try {
      const response = await fetch("/api/sudoku/leaderboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, token: sessionToken }),
      });
      const payload = await response.json() as LeaderboardSnapshot & { error?: string };
      if (!response.ok || payload.error) {
        const messages: Record<string, string> = {
          inappropriate_display_name: "Please choose a different public nickname.",
          invalid_display_name: "Use 2–16 letters, numbers, spaces, underscores, or hyphens.",
          leaderboard_already_joined: "This browser has already joined today’s leaderboard.",
          completion_not_eligible: "This completion is not eligible for the public leaderboard.",
          leaderboard_closed: "Today’s leaderboard has closed. Come back for the new puzzle.",
        };
        throw new Error(messages[payload.error ?? ""] ?? "Your score could not be submitted. Try again.");
      }
      setLeaderboard(payload);
      saveLeaderboardDisplayName(localStorage, displayName);
      sudokuAnalytics.leaderboardSubmitted({ rank: payload.ownRank ?? undefined });
    } catch (cause) {
      setJoinError(cause instanceof Error ? cause.message : "Your score could not be submitted.");
      sudokuAnalytics.leaderboardSubmitFailed({ reason: "request_failed" });
    } finally {
      setJoiningLeaderboard(false);
    }
  }, [displayName, serverResult, sessionToken]);

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

  const hintCells = useMemo(
    () => new Set(hint ? hintHighlightCells(hint, hint.level) : []),
    [hint],
  );

  if (loadError) return <div className="rounded-3xl bg-red-100 p-6 text-center text-red-900" role="alert"><p className="font-bold">{loadError}</p><button className="mt-4 rounded-full bg-red-900 px-5 py-3 font-black text-white" onClick={() => setLoadAttempt((attempt) => attempt + 1)} type="button">Try Again</button></div>;
  if (!puzzle) return <div className="rounded-3xl bg-white/70 p-8 text-center font-bold">Loading today&apos;s puzzle…</div>;

  return (
    <div>
      {serverResult && completionOpen && <CompletionDialog
        feedback={feedback}
        leaderboardSlot={<LeaderboardJoin
          displayName={displayName}
          error={joinError}
          joined={leaderboard?.ownRank !== null && leaderboard?.ownRank !== undefined}
          joining={joiningLeaderboard}
          onChange={setDisplayName}
          onStart={startLeaderboardJoin}
          onSubmit={() => void submitLeaderboard()}
          ownRank={leaderboard?.ownRank ?? null}
          sessionReady={Boolean(sessionToken)}
          started={joinStarted}
        />}
        onClose={() => setCompletionOpen(false)}
        onCopy={() => void copyResult()}
        onFeedback={chooseFeedback}
        onShare={() => void shareResult()}
        result={serverResult}
        secondsToNext={secondsToNext}
        shareStatus={shareStatus}
        stats={localStats}
      />}
      {sessionWarning && <p className="mb-4 rounded-2xl bg-amber-100 p-4 font-bold text-amber-950" role="status">{sessionWarning}</p>}
      {gameError && <p className="mb-4 rounded-2xl bg-red-100 p-4 font-bold text-red-900" role="alert">{gameError}</p>}
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
              hintCells.has(index) ? "bg-amber-100 ring-2 ring-inset ring-amber-400" : "",
              hint?.level === 3 && hint.targetCells.includes(index) ? "bg-sky-100 ring-2 ring-inset ring-sky-500" : "",
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
        {serverResult && <section className="rounded-2xl bg-emerald-950 p-5 text-white">
          <p className="font-black">Today&apos;s puzzle is complete.</p>
          <p className="mt-1 text-sm text-white/70">Time {formatTime(serverResult.durationSeconds)} · {serverResult.hintCount} hint{serverResult.hintCount === 1 ? "" : "s"}</p>
          <button className="mt-4 w-full rounded-xl bg-white px-4 py-3 font-black text-emerald-950" onClick={() => setCompletionOpen(true)} type="button">View result</button>
        </section>}
        <section className="rounded-2xl border border-emerald-950/15 bg-white/75 p-4">
          {hintError && <p className="mb-3 rounded-lg bg-red-100 p-3 text-sm font-bold leading-5 text-red-900" role="alert">{hintError}</p>}
          {hint ? <>
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Step {hint.level} of 3 · {hint.title}</p><button className="text-sm font-bold text-[var(--ink-soft)]" onClick={() => { setHint(null); setHintFingerprint(null); }}>Close</button></div>
            <p className="mt-3 text-sm leading-6">{hint.explanation}</p>
            {hint.level < 3 && <button className="mt-4 w-full rounded-xl bg-sky-700 px-4 py-3 font-black text-white disabled:opacity-50" disabled={Boolean(serverResult)} onClick={revealHintLevel}>{hint.level === 1 ? "Show More" : "Show the Cell"}</button>}
            {hint.level === 3 && <button className="mt-4 w-full rounded-xl bg-sky-700 px-4 py-3 font-black text-white disabled:opacity-50" disabled={Boolean(serverResult)} onClick={applyHintMove}>Apply Move</button>}
          </> : <>
            <p className="font-black">Need a nudge?</p><p className="mt-1 text-sm leading-5 text-[var(--ink-soft)]">Hints reveal one logical step at a time. You choose whether to apply it.</p>
            <button className="mt-3 w-full rounded-xl bg-sky-700 px-4 py-3 font-black text-white disabled:opacity-50" disabled={!sessionId || hintLoading || Boolean(serverResult)} onClick={() => void requestHint()}>{hintLoading ? "Finding a hint…" : "Get a hint"}</button>
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
      <DailyLeaderboard
        error={leaderboardError}
        expanded={leaderboardExpanded}
        loading={leaderboardLoading}
        onExpand={() => setLeaderboardExpanded(true)}
        onRetry={() => setLeaderboardAttempt((attempt) => attempt + 1)}
        snapshot={leaderboard}
      />
    </div>
  );
}
