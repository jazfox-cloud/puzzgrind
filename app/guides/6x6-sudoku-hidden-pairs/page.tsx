import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "Find a Hidden Pair in 6×6 Sudoku", description: "Learn to find a hidden pair in a 6×6 Sudoku row and remove extra candidates, with a worked example.", path: "/guides/6x6-sudoku-hidden-pairs" }, getBuildAppEnvironment());
}

export default function HiddenPairsGuide() {
  return <GuideShell title="Find a Hidden Pair in 6×6 Sudoku">
    <p>A hidden pair occurs when two numbers can appear in exactly the same two empty cells of a row, column or box. Those cells must hold those two numbers in some order, so you can remove other candidates from those two cells.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">A worked row example</h2>
    <p>Consider PuzzGrind&apos;s second Mini Sudoku practice puzzle. Dots represent empty cells.</p>
    <pre aria-label="Second Mini Sudoku practice puzzle; dots are empty cells" className="overflow-x-auto rounded-2xl bg-emerald-950 p-5 text-base leading-7 text-white sm:text-lg">{`. . 3 | 6 4 .\n5 6 . | . 3 2\n------+------\n1 . . | 3 . .\n6 . . | 4 2 1\n------+------\n3 . . | 5 . 4\n4 . . | . 6 .`}</pre>
    <ol className="list-decimal space-y-2 pl-6"><li>Row 3 is missing <strong>2, 4, 5 and 6</strong>. Checking each cell&apos;s column and box gives candidates 2/4/5 at column 2, 2/4/5 at column 3, 5 at column 5, and 5/6 at column 6.</li><li>In that row, <strong>2 and 4</strong> can each go only in columns 2 and 3. They form a hidden pair.</li><li>Remove 5 from the notes in row 3, columns 2 and 3. Each now has 2/4; the pair alone does not tell you which number goes in which cell.</li></ol>
    <p>In this grid, row 3, column 5 is also a single candidate: placing 5 there is another valid move. The example isolates the pair so you can see the reasoning.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Hidden pair or naked pair?</h2>
    <p>For a hidden pair, start with two numbers and check whether they are confined to the same two cells in one area. A <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides/6x6-sudoku-naked-pairs">naked pair</Link> starts with two cells that already have only the same two candidates. In either case, check the whole shared row, column or box first.</p>
    <p><Link className="font-bold text-emerald-900 underline underline-offset-4" href="/games/mini-sudoku">Play Mini Sudoku</Link> · <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides/6x6-sudoku-notes">Use candidate notes</Link></p>
  </GuideShell>;
}
