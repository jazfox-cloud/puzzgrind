"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { lexiAnalytics } from "@/lib/analytics/events";
import { formatClockTime } from "@/lib/format/time";
import type { LexiGameStatus, LexiGuessResult } from "@/lib/lexi";
import { aggregateKeyboardStates, buildLexiShareText, emptyLexiStats, loadSavedLexiGame,
  recordLexiCompletion, saveLexiGame } from "@/lib/lexi";
import type { LexiLocalStats } from "@/lib/lexi";
import { getOrCreateAnonymousId } from "@/lib/player/anonymous-id";
import { shareText } from "@/lib/share/web-share";

type Daily = { expiresAt: string; maxAttempts: 6; puzzleDate: string; puzzleId: string; wordLength: 5 };
type Status = LexiGameStatus | "started" | "expired";
type Session = { answer?: string; attemptCount: number; durationSeconds: number | null; guesses: LexiGuessResult[];
  hintCount: 0 | 1; hintLetter: string | null; restored: boolean; revision: number; status: Status; token: string };
type Board = { entries: Array<{ attempts: number; completionSeconds: number; displayName: string; hints: number; isYou: boolean; rank: number }>;
  joinedCount: number; ownRank: number | null };

const keys = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const errors: Record<string, string> = {
  invalid_word: "That word is not in the Lexi word list.", duplicate_guess: "You already tried this word.",
  revision_conflict: "Your game changed in another tab. Restoring the server version…",
  session_expired: "This daily puzzle has expired. Reload to start today’s puzzle.",
  hint_unavailable: "Hints unlock after two valid guesses.", no_hint_available: "You have already discovered every answer letter.",
  already_completed: "This game is already complete.", rate_limit_exceeded: "Please wait a moment and try again.",
};

async function json<T>(url: string, init?: RequestInit): Promise<{ data: T & { error?: string }; response: Response }> {
  const response = await fetch(url, init);
  return { response, data: await response.json() as T & { error?: string } };
}

export function LexiGame() {
  const [daily, setDaily] = useState<Daily | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<LexiGuessResult[]>([]);
  const [input, setInput] = useState("");
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<Status>("started");
  const [hintCount, setHintCount] = useState<0 | 1>(0);
  const [hintLetter, setHintLetter] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [stats, setStats] = useState<LexiLocalStats>(emptyLexiStats());
  const [displayName, setDisplayName] = useState("Player");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [secondsToNext, setSecondsToNext] = useState(0);
  const [leaderboard, setLeaderboard] = useState<Board | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [joining, setJoining] = useState(false);
  const resultCloseRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef("");
  const pressRef = useRef<(key: string) => void>(() => undefined);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const completionTracked = useRef<string | null>(null);
  const keyboardStates = useMemo(() => aggregateKeyboardStates(guesses), [guesses]);
  const terminal = status === "won" || status === "lost" || status === "expired";

  const applySession = useCallback((session: Session, puzzle: Daily) => {
    setToken(session.token); setGuesses(session.guesses); setRevision(session.revision); setStatus(session.status);
    setHintCount(session.hintCount); setHintLetter(session.hintLetter); setDuration(session.durationSeconds);
    setAnswer(session.answer ?? null); setStarted(true); inputRef.current = ""; setInput("");
    if (session.status === "won" || session.status === "lost") setResultOpen(true);
    if (session.status === "won" && completionTracked.current !== puzzle.puzzleId) {
      completionTracked.current = puzzle.puzzleId;
      setStats((current) => {
        const next = recordLexiCompletion(current, { puzzleDate: puzzle.puzzleDate, puzzleId: puzzle.puzzleId }).stats;
        return next;
      });
      if (!session.restored) lexiAnalytics.gameComplete(session.attemptCount, session.hintCount, session.durationSeconds ?? 0);
    }
  }, []);

  const start = useCallback(async (puzzle: Daily) => {
    setBusy(true); setMessage(null);
    try {
      const anonymousId = getOrCreateAnonymousId(localStorage, () => crypto.randomUUID());
      const { response, data } = await json<Session>("/api/lexi/session/start", { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ anonymousId }) });
      if (!response.ok) throw new Error(errors[data.error ?? ""] ?? "Unable to start today’s Lexi.");
      applySession(data, puzzle);
      if (!data.restored) lexiAnalytics.gameStart();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to start today’s Lexi."); }
    finally { setBusy(false); }
  }, [applySession]);

  const loadBoard = useCallback(async (puzzle: Daily, nextExpanded = false, sessionToken: string | null = null) => {
    try {
      const { response, data } = await json<Board>(`/api/lexi/leaderboard?limit=${nextExpanded ? 20 : 10}`,
        { headers: sessionToken ? { authorization: `Bearer ${sessionToken}` } : undefined });
      if (!response.ok) throw new Error("Today’s leaderboard is unavailable.");
      setLeaderboard(data); setLeaderboardError(null); lexiAnalytics.leaderboardView(nextExpanded ? 20 : 10);
    } catch { setLeaderboardError("Today’s leaderboard is unavailable."); }
  }, []);

  useEffect(() => {
    let active = true;
    void json<Daily>("/api/lexi/today").then(({ response, data }) => {
      if (!active) return;
      if (!response.ok) throw new Error("Today’s Lexi is unavailable right now.");
      setDaily(data); setSecondsToNext(Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)));
      const saved = loadSavedLexiGame(localStorage, data.puzzleId);
      if (saved) {
        setStats(saved.stats); setDisplayName(saved.displayName); setGuesses(saved.guesses); setRevision(saved.revision);
        setHintCount(saved.hintCount); setHintLetter(saved.hintLetter); setStatus(saved.status); setToken(saved.token);
        void start(data);
      }
      void loadBoard(data, false, saved?.token ?? null);
    }).catch((cause) => active && setMessage(cause instanceof Error ? cause.message : "Unable to load today’s Lexi."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [loadBoard, start]);

  useEffect(() => {
    if (!daily) return;
    const timer = window.setInterval(() => setSecondsToNext(Math.max(0,
      Math.floor((new Date(daily.expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [daily]);

  useEffect(() => {
    if (!daily || !token) return;
    saveLexiGame(localStorage, { version: 1, puzzleId: daily.puzzleId, puzzleDate: daily.puzzleDate,
      token, revision, guesses, hintCount, hintLetter, status, stats, displayName });
  }, [daily, displayName, guesses, hintCount, hintLetter, revision, stats, status, token]);

  const submit = useCallback(async () => {
    const currentInput = inputRef.current;
    if (!daily || !token || currentInput.length !== 5 || busy || terminal) return;
    setBusy(true); setMessage(null);
    try {
      const { response, data } = await json<{ answer?: string; attemptCount: number; durationSeconds: number | null;
        evaluation: LexiGuessResult["evaluation"]; revision: number; status: Status }>("/api/lexi/guess", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, guess: currentInput, revision }),
      });
      if (!response.ok) {
        if (data.error === "revision_conflict") await start(daily);
        if (data.error === "session_expired") setStatus("expired");
        throw new Error(errors[data.error ?? ""] ?? "Unable to submit that guess.");
      }
      const nextGuesses = [...guesses, { guess: currentInput.toLowerCase(), evaluation: data.evaluation }];
      setGuesses(nextGuesses); setRevision(data.revision); setStatus(data.status); setDuration(data.durationSeconds);
      setAnswer(data.answer ?? null); inputRef.current = ""; setInput(""); lexiAnalytics.guessSubmit(data.attemptCount);
      if (data.status === "won") {
        const next = recordLexiCompletion(stats, { puzzleDate: daily.puzzleDate, puzzleId: daily.puzzleId });
        setStats(next.stats); setResultOpen(true); completionTracked.current = daily.puzzleId;
        lexiAnalytics.gameComplete(data.attemptCount, hintCount, data.durationSeconds ?? 0);
      } else if (data.status === "lost") { setResultOpen(true); lexiAnalytics.gameFail(hintCount); }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to submit that guess."); }
    finally { setBusy(false); }
  }, [busy, daily, guesses, hintCount, revision, start, stats, terminal, token]);

  const press = useCallback((key: string) => {
    if (!started || terminal || busy) return;
    if (key === "ENTER") { void submit(); return; }
    if (key === "BACKSPACE") { inputRef.current = inputRef.current.slice(0, -1); setInput(inputRef.current); return; }
    if (/^[A-Z]$/u.test(key) && inputRef.current.length < 5) { inputRef.current += key; setInput(inputRef.current); }
  }, [busy, started, submit, terminal]);
  useLayoutEffect(() => { pressRef.current = press; }, [press]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      if (event.key === "Escape") { setHelpOpen(false); setResultOpen(false); return; }
      const key = event.key === "Enter" ? "ENTER" : event.key === "Backspace" ? "BACKSPACE" : event.key.toUpperCase();
      if (/^[A-Z]$/u.test(key) || key === "ENTER" || key === "BACKSPACE") { event.preventDefault(); pressRef.current(key); }
    };
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
  }, []);

  async function hint() {
    if (!token || busy) return;
    setBusy(true); setMessage(null);
    try {
      const { response, data } = await json<{ hintCount: 1; letter: string }>("/api/lexi/hint", { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      if (!response.ok) throw new Error(errors[data.error ?? ""] ?? "Hint unavailable.");
      setHintCount(1); setHintLetter(data.letter); lexiAnalytics.hintUse(guesses.length);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Hint unavailable."); }
    finally { setBusy(false); }
  }

  async function share() {
    if (!daily || (status !== "won" && status !== "lost")) return;
    const text = buildLexiShareText({ durationSeconds: duration ?? 0, guesses, hintsUsed: hintCount,
      puzzleDate: daily.puzzleDate, status });
    const outcome = await shareText({ share: navigator.share?.bind(navigator), clipboard: navigator.clipboard },
      { title: "PuzzGrind Lexi Daily", text });
    setShareStatus(outcome === "shared" ? "Shared!" : outcome === "copied" ? "Copied!" : "Unable to share.");
    if (outcome === "shared" || outcome === "copied") lexiAnalytics.share(outcome === "shared" ? "web_share" : "clipboard");
  }

  async function join() {
    if (!token || status !== "won") return;
    setJoining(true); setMessage(null);
    try {
      const { response, data } = await json<Board>("/api/lexi/leaderboard", { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ token, nickname: displayName }) });
      if (!response.ok) throw new Error(errors[data.error ?? ""] ?? "Unable to join the leaderboard.");
      setLeaderboard(data);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to join the leaderboard."); }
    finally { setJoining(false); }
  }

  useEffect(() => {
    if (!resultOpen && !helpOpen) return;
    lastFocusRef.current = document.activeElement as HTMLElement; window.setTimeout(() => resultCloseRef.current?.focus(), 0);
    return () => lastFocusRef.current?.focus();
  }, [helpOpen, resultOpen]);

  if (loading) return <div className="rounded-3xl bg-white/70 p-8 font-bold" role="status">Loading today’s Lexi…</div>;
  if (!daily) return <div className="rounded-3xl bg-red-50 p-6 text-red-900" role="alert">{message ?? "Today’s Lexi is unavailable."}</div>;

  return <>
    <section aria-label="Lexi Daily game" className="mx-auto max-w-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-[var(--ink-soft)]">
        <span>{daily.puzzleDate} · 6 guesses</span><span>Next puzzle in {formatClockTime(secondsToNext)}</span>
      </div>
      {!started && <button className="mt-8 min-h-12 w-full rounded-2xl bg-blue-950 px-6 py-3 font-black text-white disabled:opacity-60" disabled={busy} onClick={() => void start(daily)} type="button">{busy ? "Starting…" : "Start today’s Lexi"}</button>}
      <div aria-label="Lexi guess grid" className="mt-7 grid gap-2" role="grid">
        {Array.from({ length: 6 }, (_, rowIndex) => {
          const result = guesses[rowIndex];
          const letters = result?.guess.toUpperCase().split("") ?? (rowIndex === guesses.length ? input.split("") : []);
          return <div aria-label={`Guess ${rowIndex + 1}`} className="grid grid-cols-5 gap-2" key={rowIndex} role="row">
            {Array.from({ length: 5 }, (_, column) => {
              const state = result?.evaluation[column];
              return <div aria-label={state ? `${letters[column]}, ${state}` : letters[column] ? `${letters[column]}, not submitted` : "Empty letter"}
                className={`lexi-tile ${state ? `lexi-${state}` : ""}`} key={column} role="gridcell">
                <span>{letters[column] ?? ""}</span>{state && <span aria-hidden="true" className="text-[0.55rem]">{state === "correct" ? "●" : state === "present" ? "◆" : "—"}</span>}
              </div>;
            })}
          </div>;
        })}
      </div>
      <div aria-label="Lexi keyboard" className="mt-6 space-y-2">
        {keys.map((row, rowIndex) => <div className="flex justify-center gap-1.5" key={row}>
          {rowIndex === 2 && <button className="lexi-key lexi-key-wide" onClick={() => press("ENTER")} type="button">Enter</button>}
          {[...row].map((letter) => <button aria-label={`${letter}${keyboardStates[letter.toLowerCase()] ? `, ${keyboardStates[letter.toLowerCase()]}` : ""}`}
            className={`lexi-key ${keyboardStates[letter.toLowerCase()] ? `lexi-key-${keyboardStates[letter.toLowerCase()]}` : ""}`}
            key={letter} onClick={() => press(letter)} type="button">{letter}</button>)}
          {rowIndex === 2 && <button aria-label="Backspace" className="lexi-key lexi-key-wide" onClick={() => press("BACKSPACE")} type="button">⌫</button>}
        </div>)}
      </div>
      <div aria-live="polite" className="mt-4 min-h-6 text-center text-sm font-bold text-red-800">{message}</div>
      {started && !terminal && <div className="mt-5 rounded-2xl border border-orange-300 bg-orange-50 p-4 text-sm">
        <p className="font-black">One letter hint per game</p><p className="mt-1">Reveals a letter, not its position. Using it affects leaderboard rank.</p>
        <button className="mt-3 min-h-11 rounded-xl bg-orange-600 px-4 font-black text-white disabled:opacity-50" disabled={busy || guesses.length < 2 || hintCount > 0} onClick={() => void hint()} type="button">
          {hintCount ? `Hint: the answer contains ${hintLetter?.toUpperCase()}` : guesses.length < 2 ? `Locked · ${2 - guesses.length} valid guesses to go` : "Use my hint"}
        </button>
      </div>}
      <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm"><button className="font-bold underline" onClick={() => setHelpOpen(true)} type="button">How to play</button><span>Local streak: <strong>{stats.currentStreak}</strong></span></div>
    </section>

    <section aria-labelledby="lexi-leaderboard" className="mx-auto mt-12 max-w-2xl rounded-3xl border border-emerald-950/15 bg-white/70 p-5 sm:p-7">
      <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-800">Daily standings</p><h2 className="text-2xl font-black" id="lexi-leaderboard">Today’s leaderboard</h2></div><span className="text-sm font-bold">{leaderboard?.joinedCount ?? 0} joined</span></div>
      {leaderboardError && <p className="mt-4 text-red-800" role="alert">{leaderboardError}</p>}
      {!leaderboardError && leaderboard?.entries.length === 0 && <p className="mt-5 rounded-xl bg-blue-50 p-4 font-bold">No scores yet. Be the first.</p>}
      {!!leaderboard?.entries.length && <ol className="mt-5 overflow-hidden rounded-xl border border-emerald-950/10">
        {leaderboard.entries.map((entry) => <li className={`grid grid-cols-[2.5rem_1fr_auto_auto] gap-2 border-t p-3 text-sm first:border-0 ${entry.isYou ? "bg-orange-100" : "bg-white"}`} key={`${entry.rank}-${entry.displayName}`}><strong>#{entry.rank}</strong><span className="truncate font-bold">{entry.displayName}{entry.isYou ? " (you)" : ""}</span><span>{entry.attempts}/6</span><span>{entry.hints ? "Hint" : formatClockTime(entry.completionSeconds)}</span></li>)}
      </ol>}
      {!expanded && (leaderboard?.joinedCount ?? 0) > 10 && <button className="mt-4 w-full rounded-xl border p-3 font-black" onClick={() => { setExpanded(true); void loadBoard(daily, true, token); }} type="button">Show Top 20</button>}
      {status === "won" && leaderboard?.ownRank == null && <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void join(); }}><label className="sr-only" htmlFor="lexi-name">Anonymous nickname</label><input className="min-h-12 flex-1 rounded-xl border px-4 font-bold" id="lexi-name" maxLength={16} minLength={2} onChange={(event) => setDisplayName(event.target.value)} value={displayName}/><button className="min-h-12 rounded-xl bg-blue-950 px-5 font-black text-white" disabled={joining} type="submit">{joining ? "Joining…" : "Join leaderboard"}</button></form>}
      {leaderboard?.ownRank && <p className="mt-4 rounded-xl bg-orange-100 p-4 text-center font-black">You ranked #{leaderboard.ownRank} today.</p>}
    </section>

    {(resultOpen || helpOpen) && <div aria-label={helpOpen ? "How to play Lexi" : status === "won" ? "Lexi solved" : "Lexi result"} aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4" role="dialog">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#fffdf5] p-6 shadow-2xl sm:p-8">
        <button aria-label="Close dialog" className="float-right rounded-full border px-3 py-2 font-black" onClick={() => { setResultOpen(false); setHelpOpen(false); }} ref={resultCloseRef} type="button">Close</button>
        {helpOpen ? <><h2 className="text-3xl font-black">How to play Lexi</h2><p className="mt-5 leading-7">Guess the shared five-letter word in six valid tries. Blue with a circle means correct position, orange with a diamond means present elsewhere, and gray with a dash means absent. Repeated letters are evaluated by how many times they appear.</p><div className="mt-5 flex gap-2"><span className="lexi-tile lexi-correct">A</span><span className="lexi-tile lexi-present">B</span><span className="lexi-tile lexi-absent">C</span></div></> : <><p className="text-sm font-black uppercase tracking-[.16em] text-blue-800">Daily result</p><h2 className="mt-2 text-4xl font-black">{status === "won" ? "Solved!" : "Good try"}</h2>{status === "lost" && answer && <p className="mt-4">Today’s answer was <strong className="uppercase">{answer}</strong>.</p>}<dl className="mt-6 grid grid-cols-2 gap-3 text-center"><div className="rounded-xl bg-blue-50 p-4"><dt className="text-xs font-bold uppercase">Attempts</dt><dd className="text-2xl font-black">{guesses.length}/6</dd></div><div className="rounded-xl bg-orange-50 p-4"><dt className="text-xs font-bold uppercase">Hints</dt><dd className="text-2xl font-black">{hintCount}</dd></div><div className="rounded-xl bg-slate-100 p-4"><dt className="text-xs font-bold uppercase">Time</dt><dd className="text-2xl font-black">{formatClockTime(duration ?? 0)}</dd></div><div className="rounded-xl bg-emerald-50 p-4"><dt className="text-xs font-bold uppercase">Streak</dt><dd className="text-2xl font-black">{stats.currentStreak}</dd></div></dl><button className="mt-6 w-full rounded-xl bg-blue-950 p-3 font-black text-white" onClick={() => void share()} type="button">Share result</button>{shareStatus && <p className="mt-2 text-center font-bold" role="status">{shareStatus}</p>}<p className="mt-4 text-center text-xs text-[var(--ink-soft)]">Streaks are stored only in this browser.</p></>}
      </div>
    </div>}
  </>;
}
