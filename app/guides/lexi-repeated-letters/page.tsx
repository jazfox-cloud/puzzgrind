import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";
import { getBuildAppEnvironment } from "@/lib/build-environment";
import { createPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return createPageMetadata({ title: "How Repeated Letters Work in Lexi Daily", description: "Learn how Lexi Daily marks repeated letters with a clear five-letter worked example.", path: "/guides/lexi-repeated-letters" }, getBuildAppEnvironment());
}
export default function LexiRepeatedLettersGuide() {
  return <GuideShell title="How Repeated Letters Work in Lexi Daily" category="Lexi Daily" gameHref="/games/lexi-daily" gameLabel="Play Lexi">
    <p>In Lexi Daily, a repeated letter in your guess is marked for each matching occurrence in the answer. Correct positions are matched first; other copies are marked present only while unmatched copies remain. That means one copy may be orange while another is gray.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">Example: LEVEL and EERIE</h2>
    <p>Suppose the answer is <strong>LEVEL</strong> and the guess is <strong>EERIE</strong>. This is an illustrative example, not today&apos;s answer.</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[280px] border-collapse text-left text-base"><caption className="sr-only">Feedback for EERIE when the answer is LEVEL</caption><thead><tr className="border-b border-emerald-950/20"><th className="p-2">Position</th><th className="p-2">Guess</th><th className="p-2">Feedback</th></tr></thead><tbody>{[["1", "E", "Orange · elsewhere"], ["2", "E", "Blue · correct"], ["3", "R", "Gray · absent"], ["4", "I", "Gray · absent"], ["5", "E", "Gray · extra copy"]].map(([position, letter, result]) => <tr className="border-b border-emerald-950/10" key={position}><td className="p-2">{position}</td><td className="p-2 font-bold">{letter}</td><td className="p-2">{result}</td></tr>)}</tbody></table></div>
    <p>The second E is blue because it matches the second position. LEVEL has one other E, in position 4, so the first E is orange. Both answer E&apos;s are now accounted for; the third guessed E is gray. R and I do not occur in LEVEL.</p>
    <h2 className="!mt-9 text-2xl font-black text-emerald-950">What to do with that feedback</h2>
    <p>A gray duplicate does not always mean the letter is absent from the answer. Use the blue and orange copies to establish the count, then avoid placing orange letters in their previously marked positions. Blue uses a circle, orange a diamond and gray a dash, so the feedback is also distinguishable without color.</p>
    <p>Lexi gives you six valid guesses. After two valid guesses, one optional hint can reveal a letter, not its position; using it affects leaderboard ranking.</p>
    <p><Link className="font-bold text-emerald-900 underline underline-offset-4" href="/games/lexi-daily">Play Lexi Daily</Link> · <Link className="font-bold text-emerald-900 underline underline-offset-4" href="/guides">More puzzle guides</Link></p>
  </GuideShell>;
}
