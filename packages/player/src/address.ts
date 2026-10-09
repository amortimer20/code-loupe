/** Internal location shape. Authored actions normalize into this before state changes. */
export interface Address {
  var: string;
  index?: number;
  key?: string;
  attribute?: string;
}
export interface ScopedAddress extends Address { scope?: 'global' }

export function parseAddress(value: unknown, fail: (message: string) => never): Address {
  if (typeof value !== 'string' || !value.length) fail('an address must be nonempty text.');
  const text = value as string;
  if (/\s/.test(text)) fail('no whitespace is allowed inside an address.');
  const match = /^([A-Za-z_][A-Za-z0-9_]*)(.*)$/.exec(text);
  if (!match) fail(`invalid address \`${text}\`: start with a name, optionally followed by one accessor.`);
  const [, name, suffix] = match!;
  if (!suffix) return { var: name };
  if (/^\.[A-Za-z_][A-Za-z0-9_]*$/.test(suffix)) return { var: name, attribute: suffix.slice(1) };
  if (suffix.startsWith('[') && suffix.endsWith(']')) {
    const accessor = suffix.slice(1, -1);
    if (/^\d+$/.test(accessor)) {
      const index = Number(accessor);
      if (!Number.isSafeInteger(index)) fail('a list index must be a nonnegative safe integer.');
      return { var: name, index };
    }
    let key: unknown;
    if (accessor.startsWith('"')) {
      try { key = JSON.parse(accessor); }
      catch { fail(`invalid quoted key in address \`${text}\`; use one JSON double-quoted key.`); }
    } else if (/^'[^'\\]*'$/.test(accessor)) key = accessor.slice(1, -1);
    else fail(`invalid accessor in address \`${text}\`; use one nonnegative integer index or quoted key.`);
    if (typeof key !== 'string' || !key.length) fail('dictionary keys must be nonempty strings.');
    return { var: name, key: key as string };
  }
  return fail(`invalid address \`${text}\`: use at most one index, quoted key, or attribute accessor.`);
}

/** Reject removed keys with a concrete replacement, including in saved drafts. */
export function normalizeAddress(value: unknown, action: string, fail: (message: string) => never, extraKeys: string[] = []): ScopedAddress {
  if (typeof value === 'string') return parseAddress(value, fail);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`\`${action}\` needs an address or a mapping with target and optional scope.`);
  const spec = value as Record<string, unknown>;
  const removed = ['var', 'index', 'key', 'attribute'].filter(key => Object.hasOwn(spec, key));
  if (removed.length) {
    const name = typeof spec.var === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(spec.var) ? spec.var : 'numbers';
    const target = name + (spec.attribute !== undefined ? `.${spec.attribute}` : spec.key !== undefined ? `[${JSON.stringify(spec.key)}]` : spec.index !== undefined ? `[${spec.index}]` : '');
    const example = ['select', 'remove', 'from'].includes(action) ? `${action}: '${target}'`
      : `${action}: { target: '${target}', … }`;
    fail(`${removed.map(key => `\`${action}.${key}\``).join('/')} ${removed.length > 1 ? 'are' : 'is'} replaced by an address, e.g. \`${example}\`.`);
  }
  for (const key of Object.keys(spec)) {
    if (!['target', 'scope', ...extraKeys].includes(key)) fail(`unknown ${action} key \`${key}\`.`);
  }
  if (spec.scope !== undefined && spec.scope !== 'global') fail(`\`${action}.scope\` must be \`global\` when supplied.`);
  return { ...parseAddress(spec.target, fail), ...(spec.scope === 'global' ? { scope: 'global' as const } : {}) };
}
