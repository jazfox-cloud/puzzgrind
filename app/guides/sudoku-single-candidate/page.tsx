import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "How to Find a Single Candidate in 9×9 Sudoku", description: "Learn to find a single candidate in classic Sudoku using a worked 9×9 example and logical elimination.", path: "/guides/sudoku-single-candidate" }, getBuildAppEnvironment());
}
export default function SudokuSingleGuide() {
  return <GuideShell title="How to Find a Single Candidate in 9×9 Sudoku" category="Daily Sudoku" gameHref="/sudoku" gameLabel="Play Sudoku">
    <p>A single candidate is an empty cell that can take only one number after you check its row, column and 3×3 box. In classic 9×9 Sudoku, each of those areas must contain the digits 1–9 once.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">A worked example</h2>
    <p>This nearly completed grid is a teaching example, not today&apos;s puzzle. A dot is an empty cell.</p>
    <pre aria-label="Teaching grid, nine rows of nine cells; dots are empty cells" className="overflow-x-auto rounded-2xl bg-emerald-950 p-5 text-base leading-7 text-white">{`5 3 . | 6 7 8 | 9 . 2\n6 7 2 | 1 9 5 | 3 4 8\n1 9 8 | 3 4 2 | 5 6 7\n------+-------+------\n8 5 9 | 7 6 1 | 4 2 3\n4 2 6 | 8 5 3 | 7 9 1\n7 1 3 | 9 2 4 | 8 5 6\n------+-------+------\n9 6 1 | 5 3 7 | 2 8 4\n2 8 7 | 4 1 9 | 6 3 5\n3 4 5 | 2 8 6 | 1 7 9`}</pre>
    <ol className="list-decimal space-y-2 pl-6"><li>Row 1 is missing <strong>1 and 4</strong>.</li><li>Column 3 already contains <strong>1</strong> in row 7, so 1 cannot go in row 1, column 3.</li><li><strong>4</strong> is the only candidate left for row 1, column 3. The remaining empty cell in row 1 then takes 1.</li></ol>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Use notes when there is more than one candidate</h2>
    <p>List the digits missing from the row, then remove those already in the cell&apos;s column or box. If several remain, use Notes to keep track and inspect another cell. A single is a deduction, not a guess.</p>
    <p>In Daily Sudoku, the hint feature can reveal the logic in stages. Read the explanation before applying a move, and use Undo if you need to revisit an entry.</p>
    <p><Link className="font-bold text-emerald-900 underline underline-offset-4" href="/sudoku">Play Daily Sudoku</Link> · <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides">More puzzle guides</Link></p>
  </GuideShell>;
}
