"use client";

import { useEffect, useRef, useState } from "react";
import { conflicts, hint, isSolved } from "@/lib/mini-sudoku/game";
import { puzzles } from "@/lib/mini-sudoku/puzzles";

type Snapshot = { board: number[]; notes: number[][] };
type Save = Snapshot & { puzzle: number };
const KEY = "puzzgrind-mini-sudoku-v1";
const emptyNotes = () => Array.from({ length: 36 }, () => [] as number[]);
const initial = (puzzle: number): Save => ({ puzzle, board: [...puzzles[puzzle]], notes: emptyNotes() });
function validSave(value: unknown): value is Save {
  if (!value || typeof value !== "object") return false;
  const s = value as Save;
  return Number.isInteger(s.puzzle) && s.puzzle >= 0 && s.puzzle < puzzles.length && Array.isArray(s.board) && s.board.length === 36 && s.board.every((v, i) => Number.isInteger(v) && v >= 0 && v <= 6 && (!puzzles[s.puzzle][i] || v === puzzles[s.puzzle][i])) && Array.isArray(s.notes) && s.notes.length === 36 && s.notes.every((n) => Array.isArray(n) && n.every((v) => Number.isInteger(v) && v >= 1 && v <= 6));
}

export function MiniSudokuGame() {
  const completionDialog = useRef<HTMLDialogElement>(null);
  const [save, setSave] = useState<Save>(() => initial(0));
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    // Restoring browser-only storage after hydration avoids a server/client mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const raw = localStorage.getItem(KEY); if (raw) { const parsed: unknown = JSON.parse(raw); if (validSave(parsed)) setSave(parsed); } }
    catch { setStorageError(true); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { setStorageError(true); }
  }, [save, ready]);
  const given = puzzles[save.puzzle];
  const errors = conflicts(save.board);
  const solved = isSolved(save.board, given);
  useEffect(() => {
    const dialog = completionDialog.current;
    if (!dialog) return;
    if (ready && solved && !dialog.open) dialog.showModal();
    else if (!solved && dialog.open) dialog.close();
  }, [ready, solved]);
  function enter(n: number) {
    if (selected === null || given[selected] || solved) return;
    const board = [...save.board]; const notes = save.notes.map((v) => [...v]);
    if (noteMode && n) {
      if (board[selected]) return;
      notes[selected] = notes[selected].includes(n) ? notes[selected].filter((v) => v !== n) : [...notes[selected], n].sort();
    } else { board[selected] = n; notes[selected] = []; }
    setHistory((old) => [...old, { board: save.board, notes: save.notes }]);
    setSave({ ...save, board, notes }); setMessage("");
  }
  function undo() {
    const previous = history[history.length - 1]; if (!previous) return;
    setSave({ ...save, ...previous }); setHistory(history.slice(0, -1)); setMessage("");
  }
  function next() {
    if (!solved && !window.confirm("Start the next puzzle? Your current progress will be replaced.")) return;
    setSave(initial((save.puzzle + 1) % puzzles.length)); setHistory([]); setSelected(null); setMessage("");
  }
  function reset() {
    if (!window.confirm("Reset this puzzle and erase your current progress?")) return;
    setSave(initial(save.puzzle)); setHistory([]); setMessage("");
  }
  function showHint() {
    const result = hint(save.board);
    if (result) { setSelected(result.index); setMessage(`Row ${Math.floor(result.index / 6) + 1}, column ${result.index % 6 + 1}: ${result.value} is the only candidate left after checking its row, column and 2 × 3 box.`); }
    else setMessage("No single-candidate hint is available. Check conflicting or incorrect entries, or try another move.");
  }
  function keyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (/^[1-6]$/.test(event.key)) { event.preventDefault(); enter(Number(event.key)); }
    else if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); enter(0); }
    else if (selected !== null && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault(); const row = Math.floor(selected / 6), col = selected % 6;
      const nextRow = Math.max(0, Math.min(5, row + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0)));
      const nextCol = Math.max(0, Math.min(5, col + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0)));
      const index = nextRow * 6 + nextCol; setSelected(index); document.getElementById(`mini-cell-${index}`)?.focus();
    }
  }
  const button = "rounded-xl border border-emerald-950/20 bg-white px-3 py-3 font-bold text-emerald-950 hover:bg-emerald-50 focus-visible:outline-4 focus-visible:outline-amber-400 disabled:opacity-40";
  return <fieldset disabled={!ready} className="mx-auto max-w-xl">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><span className="font-bold">Practice puzzle {save.puzzle + 1} / {puzzles.length}</span><span className="text-sm text-[var(--ink-soft)]">Your progress stays in this browser</span></div>
    {storageError && <p role="status" className="mb-3 rounded-xl bg-amber-100 p-3 text-sm text-amber-950">Browser storage is unavailable. You can play, but progress may not be saved.</p>}
    <div aria-label="Mini Sudoku board" className="grid grid-cols-6 overflow-hidden rounded-xl border-2 border-emerald-950 bg-emerald-950" onKeyDown={keyDown}>
      {save.board.map((value, i) => <button key={i} id={`mini-cell-${i}`} type="button" aria-label={`Row ${Math.floor(i / 6) + 1}, column ${i % 6 + 1}, ${given[i] ? `given ${value}` : value ? `value ${value}` : `empty${save.notes[i].length ? `, notes ${save.notes[i].join(", ")}` : ""}`}${errors.includes(i) ? ", conflict" : ""}`} aria-pressed={selected === i} onClick={() => setSelected(i)} style={{ borderRightWidth: i % 6 === 2 ? 3 : 1, borderBottomWidth: Math.floor(i / 6) % 2 === 1 && i < 30 ? 3 : 1 }} className={`relative aspect-square border-emerald-950/40 text-xl sm:text-3xl ${selected === i ? "bg-amber-100" : errors.includes(i) ? "bg-red-100" : "bg-white"} ${given[i] ? "font-black text-emerald-950" : "font-bold text-blue-800"} focus-visible:z-10 focus-visible:outline-4 focus-visible:outline-amber-500`}>
        {value || <span className="grid h-full grid-cols-3 grid-rows-2 place-items-center p-1 text-[10px] leading-none sm:text-xs">{[1,2,3,4,5,6].map((n) => <span key={n}>{save.notes[i].includes(n) ? n : ""}</span>)}</span>}
      </button>)}
    </div>
    <p className="mt-3 text-sm text-[var(--ink-soft)]">Select an empty cell, then choose a number. On a keyboard, use arrow keys and 1–6.</p>
    <div className="mt-4 grid grid-cols-6 gap-2">{[1,2,3,4,5,6].map((n) => <button className={`${button} text-xl`} key={n} onClick={() => enter(n)} type="button">{n}</button>)}</div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><button className={button} type="button" onClick={() => enter(0)}>Erase</button><button className={button} type="button" aria-pressed={noteMode} onClick={() => setNoteMode(!noteMode)}>Notes: {noteMode ? "on" : "off"}</button><button className={button} type="button" onClick={undo} disabled={!history.length}>Undo</button><button className={button} type="button" onClick={showHint} disabled={solved}>Hint</button></div>
    <div aria-live="polite" className="mt-4 min-h-12 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">{solved ? "Puzzle complete! Well done." : message || (errors.length ? "Some numbers conflict in a row, column or box." : "Fill every row, column and box with 1–6.")}</div>
    <div className="mt-4 flex flex-wrap gap-2"><button className={button} type="button" onClick={reset}>Reset puzzle</button><button className={`${button} !bg-emerald-950 !text-white`} type="button" onClick={next}>Next puzzle</button></div>
    <dialog ref={completionDialog} aria-labelledby="mini-complete-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border-0 bg-[#fffdf5] p-7 text-emerald-950 shadow-2xl backdrop:bg-emerald-950/60 sm:p-9">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Puzzle {save.puzzle + 1} complete</p>
      <h2 id="mini-complete-title" className="mt-3 text-3xl font-black tracking-[-0.04em]">Well done!</h2>
      <p className="mt-3 leading-7 text-[var(--ink-soft)]">You solved this Mini Sudoku. Ready for the next one?</p>
      <div className="mt-6 flex flex-wrap gap-3"><button autoFocus className={`${button} !bg-emerald-950 !text-white`} type="button" onClick={() => { completionDialog.current?.close(); next(); }}>Play next puzzle</button><button className={button} type="button" onClick={() => completionDialog.current?.close()}>View completed puzzle</button></div>
    </dialog>
  </fieldset>;
}
