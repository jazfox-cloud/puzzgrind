import { NONOGRAM_EPOCH, NONOGRAM_TIMEZONE } from "@/lib/nonogram/calendar";
import { FIVE_BY_FIVE, TEN_BY_TEN } from "@/lib/nonogram/puzzles";

export const NONOGRAM_COUNTS = { five: FIVE_BY_FIVE.length, ten: TEN_BY_TEN.length } as const;

export function nonogramCoverage() {
  return `This first set contains ${NONOGRAM_COUNTS.five} original 5×5 pictures and ${NONOGRAM_COUNTS.ten} original 10×10 pictures. Numbering starts at ${NONOGRAM_EPOCH} ${NONOGRAM_TIMEZONE}. Puzzle 1 is that date, and the list then advances one picture per UTC day. After picture ${NONOGRAM_COUNTS.five} on the 5×5 board, and after picture ${NONOGRAM_COUNTS.ten} on the 10×10 board, the list starts over. The same UTC date always returns the same picture. A date before ${NONOGRAM_EPOCH} walks backward through the list. This is a fixed set, not a new picture for every future date.`;
}

export function nonogramFaqs() {
  return [
    {
      question: "How do the row and column numbers work?",
      answer: "Each number is one continuous run of filled cells. Numbers are read in order, and two runs in the same line have at least one empty cell between them. A zero means that line has no filled cells.",
    },
    {
      question: "What is the difference between Fill and Cross?",
      answer: "Fill paints a cell you believe belongs in the picture. Cross marks a cell you believe is empty. Tap the same mark again to clear it. Crosses are notes, so the puzzle can be finished without crossing every empty cell.",
    },
    {
      question: "When does the daily puzzle change?",
      answer: `Both sizes change at 00:00 ${NONOGRAM_TIMEZONE}. Daily Nonogram uses the UTC calendar date, the same day boundary as Daily Sudoku and Lexi Daily. Local midnight does not change the puzzle. For example, 00:30 in Japan on July 15 is still July 14 in UTC.`,
    },
    {
      question: "How many puzzles are in this set?",
      answer: nonogramCoverage(),
    },
    {
      question: "Are these puzzles checked?",
      answer: "Yes. Every picture in this set was checked before publication: the numbers match the picture, the numbers allow only one solution, and the picture can be reached from the numbers by line logic, without guessing. The set does not include an uncheckable random grid.",
    },
    {
      question: "Will my progress be saved if I leave?",
      answer: "Progress, undo history, the timer, and a finished result are stored in this browser for each picture. Coming back on the same UTC date restores that picture. On the next UTC date, the page shows the next picture and leaves the previous one stored. Clearing site data, or using another browser, starts fresh. No account is required.",
    },
  ];
}

export function nonogramFaqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: nonogramFaqs().map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
