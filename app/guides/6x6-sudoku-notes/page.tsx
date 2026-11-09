import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "How to Use Notes in 6×6 Sudoku", description: "Keep track of candidates in Mini Sudoku, remove outdated notes and turn a single remaining candidate into a move.", path: "/guides/6x6-sudoku-notes" }, getBuildAppEnvironment());
}

export default function NotesGuide() {
  return <GuideShell title="How to Use Notes in 6×6 Sudoku">
    <p>Notes are small reminders of numbers that could fit an empty cell. They are not answers: check each candidate against the cell&apos;s row, column and 2-row by 3-column box before writing a number in the grid.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">A practical example</h2>
    <p>In PuzzGrind&apos;s first Mini Sudoku puzzle, row 1, column 2 is empty. Its row already contains 5 and 3, its column contains 2 and 4, and its box contains 4. That leaves <strong>1 and 6</strong> as candidates. Note both; neither is established by this check alone.</p>
    <pre aria-label="First practice puzzle; dots are empty cells" className="overflow-x-auto rounded-2xl bg-emerald-950 p-5 text-base leading-7 text-white sm:text-lg">{`5 . 3 | . . .\n4 . 2 | 3 1 .\n------+------\n1 2 . | 5 3 .\n6 . . | 4 . 1\n------+------\n. . . | . 4 3\n. 4 1 | 6 5 .`}</pre>
    <p>Now look at row 2, column 2. Its row contains 1, 2, 3 and 4, while the same column contains 2 and 4 and its box contains 5. Only <strong>6</strong> fits there. Once you place that 6, remove 6 from the note in row 1, column 2: its remaining candidate is 1.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Use Notes in PuzzGrind</h2>
    <ol className="list-decimal space-y-2 pl-6"><li>Select an editable empty cell and turn <strong>Notes: off</strong> on.</li><li>Select a number from 1–6 to add it as a small note. Select it again to remove that note.</li><li>When a candidate becomes impossible, select that cell and remove the outdated note yourself. Review the row, column and box after each placement.</li><li>Turn Notes off before entering a final number. <strong>Undo</strong> restores the previous entry or note change; <strong>Erase</strong> clears the selected editable cell.</li></ol>
    <p>Notes do not automatically prove a number is correct. If none remain, check earlier entries and your notes instead of guessing.</p>
    <p><Link className="font-bold text-emerald-900 underline underline-offset-4" href="/games/mini-sudoku">Try notes in Mini Sudoku</Link> · <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides/6x6-sudoku-hidden-single">Find a hidden single</Link></p>
  </GuideShell>;
}
