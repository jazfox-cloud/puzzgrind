import { LEXI_WORD_LENGTH } from "./constants";

export function normalizeLexiInput(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidLexiWord(value: string): boolean {
  return value.length === LEXI_WORD_LENGTH && /^[a-z]+$/u.test(value);
}

export function normalizeValidLexiWord(input: string): string | null {
  const normalized = normalizeLexiInput(input);
  return isValidLexiWord(normalized) ? normalized : null;
}
