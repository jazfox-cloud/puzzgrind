import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "How to Find a Single Candidate in 6×6 Sudoku", description: "Learn how to find a single candidate in 6×6 Sudoku with a worked example from a playable puzzle.", path: "/guides/6x6-sudoku-single-candidate" }, getBuildAppEnvironment());
}
export default function SingleCandidateGuide() {
  return <GuideShell title="How to Find a Single Candidate in 6×6 Sudoku">
    <p>In 6×6 Sudoku, a single candidate is an empty cell that can hold only one of the numbers 1–6. Check the cell&apos;s row, column, and 2-row by 3-column box. If those three areas rule out five numbers, the remaining number is the answer.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">A worked example</h2>
    <p>The first practice puzzle in PuzzGrind starts with this grid. A dot is an empty cell.</p>
    <pre aria-label="Starting grid, six rows of six cells; dots are empty cells" className="overflow-x-auto rounded-2xl bg-emerald-950 p-5 text-base leading-7 text-white sm:text-lg">{`5 . 3 | . . .\n4 . 2 | 3 1 .\n------+------\n1 2 . | 5 3 .\n6 . . | 4 . 1\n------+------\n. . . | . 4 3\n. 4 1 | 6 5 .`}</pre>
    <p>Look at <strong>row 1, column 4</strong>:</p>
    <ol className="list-decimal space-y-2 pl-6"><li>The column already contains <strong>3, 5, 4 and 6</strong>, so none can go in the empty cell.</li><li>The top-right 2×3 box already contains <strong>1</strong>.</li><li>Of the numbers 1–6, only <strong>2</strong> remains. Place 2 in row 1, column 4.</li></ol>
    <p>This deduction uses the given numbers; it does not depend on guessing or on revealing the completed grid.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">How to use the technique yourself</h2>
    <p>Choose one empty cell and list the numbers that are missing from its row. Cross out numbers already in its column or box. If one number is left, write it in. If two or more remain, keep them as notes and check another cell. A cell with zero candidates means the current entries are inconsistent: retrace your steps instead of guessing.</p>
    <p>In PuzzGrind&apos;s Mini Sudoku, select <strong>Hint</strong> to see a supported single-candidate move when one is available. If there is no such move, the game says so rather than inventing one.</p>
    <p><Link className="font-bold text-emerald-900 underline underline-offset-4" href="/games/mini-sudoku">Play Mini Sudoku</Link> · <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides/6x6-sudoku-conflicts">Learn how to spot conflicts</Link></p>
  </GuideShell>;
}
