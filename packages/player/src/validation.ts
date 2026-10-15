/** Small shared checks for authored YAML data, free of DOM and snapshot state. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reject keys outside `allowed`, so a typo is a lesson error and not silently ignored. */
export function checkKeys(value: object, allowed: string[], label: string, fail: (msg: string) => never) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`unknown ${label} key \`${key}\`.`);
  }
}

/** Index of the nth (1-based) occurrence of needle in text, or -1. */
export function findNth(text: string, needle: string, nth: number): number {
  let index = -1;
  for (let k = 0; k < nth; k++) {
    index = text.indexOf(needle, index + 1);
    if (index < 0) return -1;
  }
  return index;
}
