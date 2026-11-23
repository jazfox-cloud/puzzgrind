import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "How Mini Sudoku Saves Your Progress", description: "Learn where PuzzGrind Mini Sudoku saves a puzzle, what Reset and Next do, and what to check if progress disappears.", path: "/guides/mini-sudoku-save-progress" }, getBuildAppEnvironment());
}

export default function SaveProgressGuide() {
  return <GuideShell title="How Mini Sudoku Saves Your Progress">
    <p>PuzzGrind Mini Sudoku saves the current practice puzzle, your entries and your notes in the browser on that device. Return using the same browser and device to continue. There is no account-based sync for this Mini Sudoku practice game.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Check that saving works</h2>
    <ol className="list-decimal space-y-2 pl-6"><li>In <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/games/mini-sudoku">Mini Sudoku</Link>, select an empty cell and enter a number or add a note.</li><li>Reload the page. Your current puzzle, entries and notes should return if browser storage is available.</li><li>If you see the warning that browser storage is unavailable, you can still play, but progress may not be saved.</li></ol>
    <p>Undo history is separate from the saved board: after a reload, do not rely on Undo to retrace moves made before the reload.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">If your board is different or missing</h2>
    <ul className="list-disc space-y-2 pl-6"><li>Return to the same browser profile and device. Another browser, device or private browsing session has separate storage.</li><li>Check whether site data was cleared or storage was blocked. Clearing site data can remove the saved puzzle, and the game cannot restore a deleted local save from an account.</li><li><strong>Reset puzzle</strong> asks for confirmation and then clears progress on the current puzzle. <strong>Next puzzle</strong> replaces the current board with the next one; if it is unfinished, the game asks for confirmation first.</li></ul>
    <p>To try a number without committing it as an answer, use <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides/6x6-sudoku-notes">Notes</Link>. Changing puzzles or clearing browser data is different from using Undo.</p>
  </GuideShell>;
}
