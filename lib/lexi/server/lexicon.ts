// Server boundary: API/repository code may import this module; Client
// Components may not. The build-boundary test enforces that rule without an
// additional runtime package.
export { VALID_LEXI_GUESS_COUNT, validLexiGuesses } from "./valid-guesses.generated";
