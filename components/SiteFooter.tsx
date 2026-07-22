import Link from "next/link";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/sudoku", label: "Daily Sudoku" },
  { href: "/games/lexi-daily", label: "Lexi Daily" },
  { href: "/privacy", label: "Privacy" },
] as const;

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex flex-wrap items-center justify-between gap-4 border-t border-emerald-950/15 py-5 text-sm text-[var(--ink-soft)] ${className}`.trim()}>
      <span>© {new Date().getUTCFullYear()} PuzzGrind</span>
      <nav aria-label="Footer">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {footerLinks.map((link) => (
            <li key={link.href}>
              <Link className="font-bold underline underline-offset-4" href={link.href}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
