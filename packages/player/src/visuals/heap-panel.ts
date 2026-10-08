import type { Snapshot } from '../state';
import { isReference } from '../values';
import { renderCollection } from './collection';
import type { ValueRenderer } from './variables';

/** Render each object once, independent of how many variable names reference it. */
export function renderHeap(host: HTMLElement, snap: Snapshot, renderer: ValueRenderer) {
  host.hidden = !snap.heap.length;
  host.replaceChildren();
  if (host.hidden) return;
  const label = document.createElement('h3');
  label.className = 'label';
  label.textContent = 'List objects';
  host.append(label);
  for (const object of snap.heap) {
    const card = document.createElement('article');
    card.className = 'heap-object';
    card.dataset.ref = object.id;
    card.setAttribute('aria-label', `List object ${object.id}`);
    const title = document.createElement('h4');
    title.className = 'heap-heading';
    title.textContent = object.id;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = object.type;
    title.append(tag);
    const owners = document.createElement('p');
    owners.className = 'heap-owners';
    const names = [...snap.vars.map(variable => ({ variable, prefix: '' })), ...snap.frames.flatMap(frame => frame.vars.map(variable => ({ variable, prefix: `${frame.name} #${frame.id}.` })))];
    const refs = names.filter(({ variable }) => isReference(variable.value) && variable.value.ref === object.id);
    owners.textContent = refs.length ? `Referenced by: ${refs.map(({ variable, prefix }) => prefix + variable.name).join(', ')}` : 'No variable references';
    const selected = snap.selection?.ref === object.id ? snap.selection.index : undefined;
    const cells = renderCollection(object.id, object.value, selected, renderer);
    cells.classList.add('value');
    card.append(title, owners, cells);
    host.append(card);
  }
}

export const heapStyles = /* css */ `
.heap-panel[hidden] { display: none; }
.heap-panel { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--ca-line); }
.heap-object { padding: 0.65rem; border: 1px solid var(--ca-line); margin-top: 0.5rem; }
.heap-heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; margin: 0; font-size: 0.85rem; overflow-wrap: anywhere; }
.heap-heading .tag { margin-left: auto; }
.heap-owners { margin: 0.35rem 0; font-size: 0.7rem; color: var(--ca-muted); overflow-wrap: anywhere; }
.heap-object .collection { font-family: var(--ca-font); font-size: 1rem; font-variant-ligatures: none; }
.reference { overflow-wrap: anywhere; color: var(--ca-accent); }
`;
