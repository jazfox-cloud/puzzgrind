"use client";

import Link from "next/link";
import { trackHomeGameSelect } from "@/lib/analytics/events";

export function GameCardLink({ children, className, gameId, href }: {
  children: React.ReactNode; className: string; gameId: "lexi_daily" | "sudoku"; href: string;
}) {
  return <Link className={className} href={href} onClick={() => trackHomeGameSelect(gameId)}>{children}</Link>;
}
