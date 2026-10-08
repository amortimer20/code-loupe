import { parse } from 'yaml';

/** A runtime value as written in a lesson file. YAML strings become language strings, numbers stay numbers. */
export type ScalarValue = string | number | boolean | null;
export type Value = ScalarValue | ScalarValue[];

/**
 * Where a value travels from: the user's most recent console input, or a variable
 * in the Variables panel.
 */
export type ValueSource = 'console' | { var: string; scope?: 'global'; index?: number };

/** Highlight an indexed element until another selection or explicit clearing. */
export interface SelectSpec {
  var: string;
  index: number;
  scope?: 'global';
}

/** Float a value above a piece of code, e.g. the result of a function call. */
export interface BadgeSpec {
  over: string;
  value: Value;
  type?: string;
  line?: number;
  nth?: number;
  from?: ValueSource;
}

/** Console output; `from: badge` flies the latest badge's value into the printed text. */
export type OutputSpec = string | { text: string; from?: 'badge' };

/** Change the most recent badge into a new value (e.g. a cast), optionally moving it. */
export interface ConvertSpec {
  value: Value;
  type?: string;
  over?: string;
  line?: number;
  nth?: number;
}

/** Store a value in a variable, optionally flying the most recent badge into it. */
export interface AssignSpec {
  var: string;
  value?: Value;
  type?: string;
  from?: 'badge';
}

/** Enter a function at `line`; `over` identifies the call in the current line. */
export interface CallSpec {
  name: string;
  line: number;
  over: string;
  nth?: number;
  args?: AssignSpec[];
}

/** Leave the active function and show its result over the saved caller target. */
export interface ReturnSpec {
  value?: Value;
  type?: string;
  from?: 'badge';
}

export interface Step {
  line?: number;
  caption?: string;
  write?: OutputSpec;
  print?: OutputSpec;
  input?: string;
  badge?: BadgeSpec;
  convert?: ConvertSpec;
  assign?: AssignSpec;
  select?: SelectSpec | null;
  call?: CallSpec;
  return?: ReturnSpec;
}

export interface Lesson {
  title?: string;
  language: string;
  code: string;
  steps: Step[];
}

export class LessonError extends Error {}

const STEP_KEYS = ['line', 'caption', 'write', 'print', 'input', 'badge', 'convert', 'assign', 'select', 'call', 'return'];

export function parseLesson(source: string): Lesson {
  let data: unknown;
  try {
    data = parse(source);
  } catch (err) {
    throw new LessonError(`The lesson isn't valid YAML:\n${(err as Error).message}`);
  }
  if (!isRecord(data)) throw new LessonError('A lesson must be a YAML mapping with language, code and steps.');

  const { title, language, code, steps } = data;
  if (typeof language !== 'string') throw new LessonError('`language` is required, e.g. `language: python`.');
  if (typeof code !== 'string') throw new LessonError('`code` is required. Use `code: |` followed by indented code.');
  if (!Array.isArray(steps)) throw new LessonError('`steps` must be a list.');

  steps.forEach((step, i) => {
    if (!isRecord(step)) throw new LessonError(`Step ${i + 1} must be a mapping, like \`- line: 1\`.`);
    for (const key of Object.keys(step)) {
      if (!STEP_KEYS.includes(key)) {
        throw new LessonError(`Step ${i + 1}: unknown key \`${key}\`. Expected one of: ${STEP_KEYS.join(', ')}.`);
      }
    }
  });

  return {
    title: typeof title === 'string' ? title : undefined,
    language,
    code: code.replace(/\n+$/, ''),
    steps: steps as Step[],
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
