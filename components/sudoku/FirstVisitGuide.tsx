"use client";

import { useEffect, useRef, useState } from "react";

import { hasSeenOnboarding, markOnboardingSeen } from "@/lib/sudoku/storage";

export function FirstVisitGuide() {
  const [open, setOpen] = useState(false);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!hasSeenOnboarding(localStorage)) setOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) return;
    startButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        markOnboardingSeen(localStorage);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const close = () => {
    markOnboardingSeen(localStorage);
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-emerald-950/55 p-4" role="presentation">
      <section
        aria-describedby="sudoku-welcome-description"
        aria-labelledby="sudoku-welcome-title"
        aria-modal="true"
        className="relative w-full max-w-md rounded-3xl bg-[#fffdf5] p-7 shadow-2xl"
        role="dialog"
      >
        <button
          aria-label="Close welcome guide"
          className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-emerald-950/20 text-xl font-bold"
          onClick={close}
          type="button"
        >
          ×
        </button>
        <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Quick start</p>
        <h2 className="mt-2 pr-10 text-3xl font-black tracking-[-0.04em]" id="sudoku-welcome-title">Welcome to PuzzGrind</h2>
        <div className="mt-5 space-y-3 leading-7 text-[var(--ink-soft)]" id="sudoku-welcome-description">
          <p>Select a cell, then choose a number.</p>
          <p>Use Notes to track possible candidates.</p>
          <p>If you get stuck, Hint will explain the next logical step.</p>
        </div>
        <button
          className="mt-7 w-full rounded-xl bg-emerald-950 px-5 py-3 font-black text-white focus:outline-4 focus:outline-amber-400"
          onClick={close}
          ref={startButtonRef}
          type="button"
        >
          Start Playing
        </button>
      </section>
    </div>
  );
}
