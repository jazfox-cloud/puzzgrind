import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "How to Find a Naked Pair in 6×6 Sudoku", description: "Use a worked 6×6 Sudoku example to eliminate candidates with a naked pair.", path: "/guides/6x6-sudoku-naked-pairs" }, getBuildAppEnvironment());
}

export default function NakedPairsGuide() {
  return <GuideShell title="How to Find a Naked Pair in 6×6 Sudoku">
    <p>A naked pair is two empty cells in the same row, column or box that each have the same two candidates. Those two numbers must occupy those cells in some order, so neither can go in another cell in that area.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">A column example</h2>
    <p>Here is PuzzGrind&apos;s second Mini Sudoku practice puzzle. Dots are empty cells.</p>
    <pre aria-label="Second practice puzzle; dots are empty cells" className="overflow-x-auto rounded-2xl bg-emerald-950 p-5 text-base leading-7 text-white sm:text-lg">{`. . 3 | 6 4 .\n5 6 . | . 3 2\n------+------\n1 . . | 3 . .\n6 . . | 4 2 1\n------+------\n3 . . | 5 . 4\n4 . . | . 6 .`}</pre>
    <ol className="list-decimal space-y-2 pl-6"><li>Check row 1, column 2: its possible numbers are <strong>1 and 2</strong> after checking its row, column and box.</li><li>Row 5, column 2 also has exactly <strong>1 and 2</strong> as candidates.</li><li>Both cells are in column 2. One must be 1 and the other 2, even though we do not yet know which is which.</li><li>Row 6, column 2 initially has candidates 1, 2 and 5. Remove 1 and 2 because of the pair; <strong>5 remains</strong>.</li></ol>
    <p>To check the last step, row 6 is missing 1, 2, 3 and 5; its box already contains 3, leaving 1, 2 and 5 before using the pair.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Avoid a common mistake</h2>
    <p>Both pair cells must have exactly the same two candidates. A cell with an extra possibility is not a naked pair. Apply the elimination only within an area shared by both cells, and recalculate after new entries.</p>
    <p><Link className="font-bold text-emerald-900 underline underline-offset-4" href="/games/mini-sudoku">Play Mini Sudoku</Link> · <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides/6x6-sudoku-notes">Learn to use notes</Link></p>
  </GuideShell>;
}
