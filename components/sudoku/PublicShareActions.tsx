"use client";

import { useState } from "react";

type Props = {
  cardUrl: string;
  shareText: string;
  shareUrl: string;
};

export function PublicShareActions({ cardUrl, shareText, shareUrl }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
  const share = async () => {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: "PuzzGrind Daily Sudoku", text: shareText, url: shareUrl });
      setStatus("Shared");
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setStatus("Link copied");
  };
  const platform = async (name: "facebook" | "instagram" | "linkedin" | "tiktok" | "x") => {
    if (name === "instagram" || name === "tiktok") {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      open(name === "instagram" ? "https://www.instagram.com/" : "https://www.tiktok.com/");
      setStatus(`Result copied — paste it into ${name === "instagram" ? "Instagram" : "TikTok"}.`);
      return;
    }
    const destinations = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    } as const;
    open(destinations[name]);
  };

  return <div className="mt-8">
    <div className="grid gap-3 sm:grid-cols-2">
      <button className="rounded-full bg-emerald-950 px-5 py-3 font-black text-white" onClick={() => void share()}>Share this result</button>
      <a className="rounded-full border border-emerald-950/20 bg-white px-5 py-3 text-center font-black text-emerald-950" download="puzzgrind-sudoku-result.png" href={cardUrl}>Save result card</a>
    </div>
    <div aria-label="Share to a social platform" className="mt-4 grid grid-cols-5 gap-2">
      {(["x", "instagram", "linkedin", "tiktok", "facebook"] as const).map((name) =>
        <button className="min-h-11 rounded-xl border border-emerald-950/15 bg-white/70 px-1 text-xs font-black" key={name} onClick={() => void platform(name)}>
          {name === "x" ? "X" : name === "instagram" ? "IG" : name === "linkedin" ? "in" : name === "tiktok" ? "TikTok" : "f"}
        </button>,
      )}
    </div>
    {status && <p className="mt-3 text-center text-sm font-bold text-emerald-800" role="status">{status}</p>}
  </div>;
}
