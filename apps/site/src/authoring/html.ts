/** Markup that is safe to insert: built with `html`, or marked with `raw`. */
export class SafeHtml {
  constructor(readonly value: string) {}
  toString() { return this.value; }
}

/** Mark a constant fragment as markup. Never pass teacher text or computed values through this. */
export const raw = (value: string) => new SafeHtml(value);

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => entities[char]);
}

function render(value: unknown): string {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(value);
}

/**
 * A template tag that escapes every interpolated value unless it is already `SafeHtml`, so a
 * forgotten `escape()` can no longer let teacher text become markup. Arrays are concatenated.
 * Interpolate nested markup with another `html` template, or `raw` for a constant fragment.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  return new SafeHtml(strings.reduce((out, text, index) => out + text + (index < values.length ? render(values[index]) : ''), ''));
}
