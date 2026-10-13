import { findNth } from 'code-loupe/state';

export interface CodeTarget { line: number; over?: string; nth?: number }

/** Use the same UTF-16 offsets and overlapping occurrences as the player. */
export function expressionTarget(code: string, line: number, start: number, end: number): CodeTarget {
  const text = code.replace(/\n+$/, '').split('\n')[line - 1];
  if (!Number.isInteger(line) || text === undefined || !Number.isInteger(start) || !Number.isInteger(end)
    || start < 0 || end <= start || end > text.length) throw new Error('Select an expression within one code line.');
  const selection = text.slice(start, end), over = selection.trim();
  if (!over) throw new Error('Select some code, rather than whitespace.');
  start += selection.length - selection.trimStart().length;
  let nth = 1;
  while (findNth(text, over, nth) < start) nth++;
  return { line, over, nth };
}
