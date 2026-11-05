import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "Why Is My 6×6 Sudoku Answer Marked as a Conflict?", description: "Find duplicate numbers in a row, column or 2×3 box and learn how to recover from mistakes in 6×6 Sudoku.", path: "/guides/6x6-sudoku-conflicts" }, getBuildAppEnvironment());
}
export default function ConflictsGuide() {
  return <GuideShell title="Why Is My 6×6 Sudoku Answer Marked as a Conflict?">
    <p>An entry conflicts when the same number appears twice in its row, its column, or its 2-row by 3-column box. In 6×6 Sudoku, each of those areas must contain the numbers 1–6 once.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Check the row first</h2>
    <p>Using PuzzGrind&apos;s first practice puzzle, row 1 begins <code className="rounded bg-emerald-100 px-1 text-emerald-950">5 . 3 | . . .</code>. Entering <strong>5</strong> in row 1, column 2 creates a conflict: there is already a 5 in that row. Erase the entry and check the remaining candidates.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Then check the column and the box</h2>
    <p>A number can be absent from the row and still be illegal. Check the six cells in the same column, then check the 2×3 box containing your cell. A box is <strong>two rows tall and three columns wide</strong>; its border matters more than its position on the screen.</p>
    <p>On the starting board below, putting <strong>1</strong> in row 1, column 4 conflicts with the 1 in row 2, column 5: both cells are in the top-right box. They are in different rows and columns, so looking only across and down would miss the conflict.</p>
    <pre aria-label="Starting grid, six rows of six cells; dots are empty cells" className="overflow-x-auto rounded-2xl bg-emerald-950 p-5 text-base leading-7 text-white sm:text-lg">{`5 . 3 | . . .\n4 . 2 | 3 1 .\n------+------\n1 2 . | 5 3 .\n6 . . | 4 . 1\n------+------\n. . . | . 4 3\n. 4 1 | 6 5 .`}</pre>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">If there is no highlighted conflict</h2>
    <p>An entry that doesn&apos;t immediately repeat a number is not necessarily correct. It may make the puzzle impossible later. If you get stuck, undo recent entries, use notes to keep alternatives separate, or ask for a hint. PuzzGrind only explains a single-candidate move when the current board supports one; otherwise it says no such hint is available.</p>
    <p><Link className="font-bold text-emerald-900 underline underline-offset-4" href="/games/mini-sudoku">Return to Mini Sudoku</Link> and try the checks on an empty cell. Given numbers are fixed and cannot be changed.</p>
    <p>Next: <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides/6x6-sudoku-single-candidate">How to find a single candidate</Link>.</p>
  </GuideShell>;
}
