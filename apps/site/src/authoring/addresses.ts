import { parseAddress, type Address } from 'code-loupe/address';

/** Parse with the player's own address grammar, so the builder and the player cannot disagree. */
export function addressOf(value: unknown): Address | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    return parseAddress(value, message => { throw new Error(message); });
  } catch {
    return undefined;
  }
}

/** A bare variable name such as `numbers`. */
export function isName(value: unknown): value is string {
  const address = addressOf(value);
  return address !== undefined && address.index === undefined && address.key === undefined && address.attribute === undefined;
}

/** A list element such as `numbers[0]`. */
export function isListAddress(value: unknown): value is string {
  return addressOf(value)?.index !== undefined;
}
