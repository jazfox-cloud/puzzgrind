const SIZE = 6;
const valid = (board: number[]) => board.length === 36 && board.every((v) => Number.isInteger(v) && v >= 0 && v <= 6);
const peers = (a: number, b: number) => a !== b && (Math.floor(a / SIZE) === Math.floor(b / SIZE) || a % SIZE === b % SIZE || (Math.floor(a / 12) === Math.floor(b / 12) && Math.floor((a % SIZE) / 3) === Math.floor((b % SIZE) / 3)));

export function conflicts(board: number[]): number[] {
  if (!valid(board)) return [];
  const found = new Set<number>();
  for (let i = 0; i < 36; i++) for (let j = i + 1; j < 36; j++) {
    if (board[i] && board[i] === board[j] && peers(i, j)) { found.add(i); found.add(j); }
  }
  return [...found];
}
export function candidates(board: number[], index: number): number[] {
  if (!valid(board) || index < 0 || index >= 36 || board[index] !== 0) return [];
  return [1,2,3,4,5,6].filter((v) => !board.some((cell, i) => cell === v && peers(index, i)));
}
export function countSolutions(input: number[]): number {
  if (!valid(input) || conflicts(input).length) return 0;
  const board = [...input];
  function search(): number {
    let next = -1; let options: number[] = [];
    for (let i = 0; i < 36; i++) if (!board[i]) {
      const choices = candidates(board, i);
      if (!choices.length) return 0;
      if (next < 0 || choices.length < options.length) { next = i; options = choices; }
    }
    if (next < 0) return 1;
    let count = 0;
    for (const n of options) { board[next] = n; count += search(); board[next] = 0; if (count >= 2) return 2; }
    return count;
  }
  return search();
}
export function hint(board: number[]): { index: number; value: number } | null {
  if (!valid(board) || conflicts(board).length || countSolutions(board) !== 1) return null;
  for (let i = 0; i < 36; i++) { const choices = candidates(board, i); if (choices.length === 1) return { index: i, value: choices[0] }; }
  return null;
}
export function isSolved(board: number[], givens: number[]): boolean {
  return valid(board) && valid(givens) && !board.includes(0) && conflicts(board).length === 0 && givens.every((v, i) => !v || board[i] === v);
}
