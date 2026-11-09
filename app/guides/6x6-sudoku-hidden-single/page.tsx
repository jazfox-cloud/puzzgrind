import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "Find a Hidden Single in 6×6 Sudoku", description: "Find where a number can go only once in a 6×6 Sudoku box, even if the cell has multiple candidates.", path: "/guides/6x6-sudoku-hidden-single" }, getBuildAppEnvironment());
}

export default function HiddenSingleGuide() {
  return <GuideShell title="Find a Hidden Single in 6×6 Sudoku">
    <p>A hidden single appears when a number has only one possible cell in a row, column or box. The cell may still have other candidates; the key is that the number has nowhere else to go in that area.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Example: find 1 in a box</h2>
    <p>Look at the top-left 2-row by 3-column box of PuzzGrind&apos;s first Mini Sudoku practice puzzle. Dots are empty cells.</p>
    <pre aria-label="First practice puzzle; dots are empty cells" className="overflow-x-auto rounded-2xl bg-emerald-950 p-5 text-base leading-7 text-white sm:text-lg">{`5 . 3 | . . .\n4 . 2 | 3 1 .\n------+------\n1 2 . | 5 3 .\n6 . . | 4 . 1\n------+------\n. . . | . 4 3\n. 4 1 | 6 5 .`}</pre>
    <ol className="list-decimal space-y-2 pl-6"><li>The top-left box has 5, 3, 4 and 2, so it needs <strong>1 and 6</strong>.</li><li>Its empty cells are row 1, column 2 and row 2, column 2.</li><li>Row 2 already has a 1 in column 5, so 1 cannot go in row 2, column 2.</li><li>That leaves <strong>row 1, column 2 for 1</strong>. Its other candidate is 6, but 1 has no other position in this box.</li></ol>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Try it on another box</h2>
    <p>Choose a number missing from a box. Check each empty cell&apos;s row and column, crossing out cells where that number already appears. If exactly one cell remains, place the number there. If several remain, leave it for now; if none remain, recheck your entries.</p>
    <p>PuzzGrind&apos;s Hint looks for a single candidate in a cell. It may not point out a hidden single when the cell itself still has multiple candidates, so use this box scan as another way to look for progress.</p>
    <p><Link className="font-bold text-emerald-900 underline underline-offset-4" href="/games/mini-sudoku">Play Mini Sudoku</Link> · <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides/6x6-sudoku-notes">Learn to use notes</Link></p>
  </GuideShell>;
}
