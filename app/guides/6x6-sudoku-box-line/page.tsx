import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "Use Box-Line Elimination in 6×6 Sudoku", description: "Learn how candidates confined to one column in a 6×6 box can eliminate that number elsewhere in the column.", path: "/guides/6x6-sudoku-box-line" }, getBuildAppEnvironment());
}

export default function BoxLineGuide() {
  return <GuideShell title="Use Box-Line Elimination in 6×6 Sudoku">
    <p>If every possible position for a number in a box lies in the same row or column, that number must appear in that line inside the box. You can remove it as a candidate from the rest of that row or column outside the box.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">A worked column example</h2>
    <p>Start with PuzzGrind&apos;s first Mini Sudoku puzzle. Each box covers two rows and three columns; a dot is an empty cell.</p>
    <pre aria-label="First practice puzzle; dots are empty cells" className="overflow-x-auto rounded-2xl bg-emerald-950 p-5 text-base leading-7 text-white sm:text-lg">{`5 . 3 | . . .\n4 . 2 | 3 1 .\n------+------\n1 2 . | 5 3 .\n6 . . | 4 . 1\n------+------\n. . . | . 4 3\n. 4 1 | 6 5 .`}</pre>
    <ol className="list-decimal space-y-2 pl-6"><li>The top-left box needs 1 and 6. Its only empty cells are row 1, column 2 and row 2, column 2.</li><li>Both possible places for <strong>6</strong> lie in column 2, so the 6 in this box must also be the 6 for column 2.</li><li>Row 5, column 2 is outside that box. Before this elimination it can be 5 or 6. Remove 6; <strong>5 remains</strong>.</li></ol>
    <p>In this example row 2, column 2 is itself a single candidate, so placing that 6 first is also valid. The box-line reasoning shows why the elimination works even before choosing between the two box cells.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Check the boundary</h2>
    <p>First verify every empty cell in the box for the chosen number. If its possible cells span two rows and two columns, this technique does not apply. Remove the candidate only outside the box and on the shared line—not from the box cells themselves.</p>
    <p><Link className="font-bold text-emerald-900 underline underline-offset-4" href="/games/mini-sudoku">Play Mini Sudoku</Link> · <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides/6x6-sudoku-single-candidate">Find a single candidate</Link></p>
  </GuideShell>;
}
