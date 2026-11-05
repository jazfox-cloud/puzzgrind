import Link from "next/link";

export function ArticlesLink() {
  return <Link className="rounded-full px-3 py-2 text-sm font-bold text-emerald-950 underline-offset-4 hover:underline focus-visible:outline-4 focus-visible:outline-amber-400" href="/guides">Articles</Link>;
}
