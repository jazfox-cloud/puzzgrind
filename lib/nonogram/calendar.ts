import { utcDate } from "@/lib/daily/utc";
import { FIVE_BY_FIVE, TEN_BY_TEN, type NonogramPuzzle, type NonogramSize } from "@/lib/nonogram/puzzles";

/** Daily Nonogram uses the same UTC calendar day as Daily Sudoku and Lexi Daily. */
export const NONOGRAM_EPOCH = "2026-01-01";
export const NONOGRAM_TIMEZONE = "UTC";

export function utcDayNumber(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new Error("Expected a YYYY-MM-DD UTC date");
  const time = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new Error("Expected a real UTC date");
  return Math.round((time - Date.parse(`${NONOGRAM_EPOCH}T00:00:00.000Z`)) / 86_400_000);
}

export function bankFor(size: NonogramSize): readonly NonogramPuzzle[] {
  return size === 5 ? FIVE_BY_FIVE : TEN_BY_TEN;
}

export function puzzleForDate(size: NonogramSize, date: string): NonogramPuzzle {
  const bank = bankFor(size);
  if (bank.length === 0) throw new Error("Nonogram bank is empty");
  const index = utcDayNumber(date) % bank.length;
  const puzzle = bank[(index + bank.length) % bank.length];
  if (!puzzle) throw new Error("Nonogram bank is empty");
  return puzzle;
}

export function puzzleNumber(size: NonogramSize, date: string) {
  const bank = bankFor(size);
  const index = utcDayNumber(date) % bank.length;
  return ((index + bank.length) % bank.length) + 1;
}

export function dailyNonograms(now = new Date()) {
  const date = utcDate(now);
  return { date, five: puzzleForDate(5, date), ten: puzzleForDate(10, date) };
}
