import type { ErrorSpec } from '../lesson';

export type ProgramError = ErrorSpec & { nth: number };

/** Validate authored diagnostics without parsing or executing the displayed code. */
export function programError(
  value: unknown,
  checkLine: (line: number) => void,
  checkTarget: (line: number, over: string, nth: number) => void,
  fail: (message: string) => never,
): ProgramError {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('`error` needs a mapping.');
  const spec = value as Record<string, unknown>;
  for (const key of Object.keys(spec)) {
    if (!['kind', 'name', 'message', 'line', 'over', 'nth'].includes(key)) fail(`unknown error key \`${key}\`.`);
  }
  if (spec.kind !== 'syntax' && spec.kind !== 'runtime') fail('`error.kind` must be syntax or runtime.');
  for (const key of ['name', 'message'] as const) {
    if (typeof spec[key] !== 'string' || !spec[key].trim()) fail(`\`error.${key}\` must be nonempty text.`);
  }
  checkLine(spec.line as number);
  const nth = spec.nth ?? 1;
  if (!Number.isInteger(nth) || (nth as number) < 1) fail('`error.nth` must be a positive integer.');
  if (spec.over !== undefined) checkTarget(spec.line as number, spec.over as string, nth as number);
  else if (spec.nth !== undefined) fail('`error.nth` needs an `over` target.');
  return { kind: spec.kind as ErrorSpec['kind'], name: spec.name as string, message: spec.message as string,
    line: spec.line as number, ...(spec.over !== undefined ? { over: spec.over as string } : {}), nth: nth as number };
}
