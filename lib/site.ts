export const SITE = {
  name: "PuzzGrind",
  origin: "https://puzzgrind.com",
  defaultTitle: "PuzzGrind — Free Daily Sudoku with Hints",
  titleTemplate: "%s | PuzzGrind",
  defaultDescription: "Play a free Daily Sudoku with logical hints, progress recovery, and shareable results.",
  socialImagePath: "/og/puzzgrind-social.png",
  locale: "en_US",
  twitterCard: "summary_large_image",
} as const;

export function siteUrl(path = "/") {
  return new URL(path, SITE.origin).toString();
}
