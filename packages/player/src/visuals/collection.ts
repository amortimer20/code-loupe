import type { ScalarValue } from '../lesson';
import { formatValue, inferType } from '../values';
import type { ValueRenderer } from './variables';

/** Indexed cells share the Variables panel, including function-local lists. */
export function renderCollection(name: string, items: ScalarValue[], selected: number | undefined, renderer: ValueRenderer) {
  const list = document.createElement('span');
  list.className = 'collection';
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', `${name}, ${items.length} elements`);
  if (!items.length) list.textContent = '[]';
  items.forEach((item, index) => {
    const cell = document.createElement('span');
    cell.className = 'collection-cell';
    cell.dataset.index = String(index);
    cell.setAttribute('role', 'listitem');
    cell.setAttribute('aria-label', `${name}[${index}] is ${formatValue(item, renderer.language)}${selected === index ? ', selected' : ''}`);
    if (selected === index) cell.setAttribute('aria-current', 'true');
    const label = document.createElement('span');
    label.className = 'collection-index';
    label.textContent = String(index);
    const value = document.createElement('span');
    value.className = 'collection-item';
    value.innerHTML = renderer.literalHtml(item, inferType(item, renderer.language));
    cell.append(label, value);
    list.append(cell);
  });
  return list;
}

/** Only the changed cell flashes; instant and reduced-motion renders skip this. */
export function animateCollectionUpdate(cell: HTMLElement, delay: number, duration: number) {
  cell.animate([
    { backgroundColor: 'color-mix(in srgb, var(--ca-accent) 35%, transparent)' },
    { backgroundColor: getComputedStyle(cell).backgroundColor },
  ], { duration, delay, easing: 'ease-out' });
}

export const collectionStyles = /* css */ `
.var.has-collection .value { flex-basis: 100%; order: 1; min-width: 0; }
.collection { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0.25rem 0; }
.collection-cell { display: inline-flex; flex-direction: column; text-align: center; min-width: 2.25ch; max-width: 100%; box-sizing: border-box; border: 1px solid var(--ca-line); }
.collection-index { font-size: 0.65rem; color: var(--ca-muted); border-bottom: 1px solid var(--ca-line); padding: 0.1rem 0.35rem; }
.collection-item { padding: 0.25rem 0.35rem; overflow-wrap: anywhere; }
.collection-cell[aria-current] { outline: 2px solid var(--ca-accent); outline-offset: -2px; background: color-mix(in srgb, var(--ca-accent) 10%, transparent); }
.collection-cell[aria-current] .collection-index::after { content: ' ←'; color: var(--ca-accent); }
`;
