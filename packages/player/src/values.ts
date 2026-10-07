import type { Value } from './lesson';

interface LanguageWords {
  true: string;
  false: string;
  null: string;
  string: string;
  int: string;
  float: string;
  bool: string;
}

const PYTHON: LanguageWords = { true: 'True', false: 'False', null: 'None', string: 'str', int: 'int', float: 'float', bool: 'bool' };
const JAVASCRIPT: LanguageWords = { true: 'true', false: 'false', null: 'null', string: 'string', int: 'number', float: 'number', bool: 'boolean' };
const GDSCRIPT: LanguageWords = { true: 'true', false: 'false', null: 'null', string: 'String', int: 'int', float: 'float', bool: 'bool' };
const CSHARP: LanguageWords = { true: 'true', false: 'false', null: 'null', string: 'string', int: 'int', float: 'double', bool: 'bool' };

const LANGUAGES: Record<string, LanguageWords> = {
  python: PYTHON,
  py: PYTHON,
  javascript: JAVASCRIPT,
  js: JAVASCRIPT,
  typescript: JAVASCRIPT,
  ts: JAVASCRIPT,
  gdscript: GDSCRIPT,
  csharp: CSHARP,
  'c#': CSHARP,
  cs: CSHARP,
};

function words(language: string): LanguageWords {
  return LANGUAGES[language.toLowerCase()] ?? JAVASCRIPT;
}

const FLOAT_TYPES = ['float', 'double', 'decimal', 'Float', 'Double'];

/** Format a value as a literal in the lesson's language, e.g. True/None in Python. */
export function formatValue(value: Value, language: string, type?: string): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    return type && FLOAT_TYPES.includes(type) && Number.isInteger(value) ? value.toFixed(1) : String(value);
  }
  const w = words(language);
  if (value === null) return w.null;
  return value ? w.true : w.false;
}

/** Guess a type name for a value when the lesson doesn't give one. */
export function inferType(value: Value, language: string): string {
  const w = words(language);
  if (typeof value === 'string') return w.string;
  if (typeof value === 'number') return Number.isInteger(value) ? w.int : w.float;
  if (typeof value === 'boolean') return w.bool;
  return language.toLowerCase().startsWith('py') ? 'NoneType' : w.null;
}
