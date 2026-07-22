export const SITE = {
  name: "PuzzGrind",
  origin: "https://puzzgrind.com",
  defaultTitle: "PuzzGrind — Daily Logic and Word Puzzles",
  titleTemplate: "%s | PuzzGrind",
  defaultDescription: "Play shared daily Sudoku and five-letter word puzzles with saved progress, helpful hints, streaks, and anonymous leaderboards.",
  socialImagePath: "/og/puzzgrind-social.png",
  locale: "en_US",
  twitterCard: "summary_large_image",
} as const;

export function siteUrl(path = "/") {
  return new URL(path, SITE.origin).toString();
}
