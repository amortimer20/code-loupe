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

export interface CapturedCell {
  rect: DOMRect;
  html: string;
  font: Pick<CSSStyleDeclaration, 'fontFamily' | 'fontSize' | 'fontWeight' | 'fontStyle' | 'lineHeight' | 'fontVariantLigatures'>;
}

export function captureCollectionCells(row: HTMLElement | null): CapturedCell[] {
  return [...row?.querySelectorAll<HTMLElement>('.collection-cell') ?? []].map(cell => {
    const style = getComputedStyle(cell);
    return {
      rect: cell.getBoundingClientRect(), html: cell.outerHTML,
      // The font shorthand can be empty with non-default ligature settings.
      font: { fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
        fontStyle: style.fontStyle, lineHeight: style.lineHeight, fontVariantLigatures: style.fontVariantLigatures },
    };
  });
}

export function animateCollectionAppend(cell: HTMLElement, delay: number, duration: number) {
  cell.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'none' }], { delay, duration, fill: 'backwards', easing: 'ease-out' });
}

/** Draw the removed cell in the overlay, then move surviving cells from their old positions. */
export function animateCollectionRemoval(row: HTMLElement, before: CapturedCell[], index: number, overlay: HTMLElement, delay: number, duration: number) {
  const removed = before[index];
  if (!removed) return;
  const base = overlay.getBoundingClientRect();
  const ghost = document.createElement('span');
  ghost.className = 'collection-removal';
  ghost.innerHTML = removed.html;
  ghost.style.left = `${removed.rect.left - base.left}px`;
  ghost.style.top = `${removed.rect.top - base.top}px`;
  ghost.style.width = `${removed.rect.width}px`;
  Object.assign(ghost.style, removed.font);
  overlay.append(ghost);
  ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.5)' }], { delay, duration, fill: 'backwards', easing: 'ease-in' })
    .finished.then(() => ghost.remove(), () => ghost.remove());
  row.querySelectorAll<HTMLElement>('.collection-cell').forEach((cell, newIndex) => {
    const old = before[newIndex < index ? newIndex : newIndex + 1];
    if (!old) return;
    const rect = cell.getBoundingClientRect();
    const dx = old.rect.left - rect.left;
    const dy = old.rect.top - rect.top;
    if (dx || dy) cell.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { delay: delay + duration, duration, fill: 'backwards', easing: 'ease-out' });
  });
}

export const collectionStyles = /* css */ `
.var.has-collection .value { flex-basis: 100%; order: 1; min-width: 0; }
.collection { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0.25rem 0; }
.collection-cell { display: inline-flex; flex-direction: column; text-align: center; min-width: 2.25ch; max-width: 100%; box-sizing: border-box; border: 1px solid var(--ca-line); }
.collection-index { font-size: 0.65rem; color: var(--ca-muted); border-bottom: 1px solid var(--ca-line); padding: 0.1rem 0.35rem; }
.collection-item { padding: 0.25rem 0.35rem; overflow-wrap: anywhere; }
.collection-cell[aria-current] { outline: 2px solid var(--ca-accent); outline-offset: -2px; background: color-mix(in srgb, var(--ca-accent) 10%, transparent); }
.collection-cell[aria-current] .collection-index::after { content: ' ←'; color: var(--ca-accent); }
.collection-removal { position: absolute; display: block; background: var(--ca-panel); }
.collection-removal > .collection-cell { width: 100%; }
`;
