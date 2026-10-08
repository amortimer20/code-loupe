import type { Snapshot } from '../state';
import { isReference } from '../values';
import { renderCollection } from './collection';
import type { ValueRenderer } from './variables';
import { formatValue, inferType } from '../values';
import type { FieldObject } from './heap-state';

function renderFields(object: FieldObject, renderer: ValueRenderer) {
  const fields = document.createElement('dl');
  fields.className = 'object-fields';
  if (!Object.keys(object.fields).length) fields.textContent = object.class === undefined ? '{}' : 'No attributes yet';
  for (const [key, value] of Object.entries(object.fields)) {
    const row = document.createElement('div');
    row.className = 'object-field';
    row.dataset.key = key;
    const label = document.createElement('dt');
    label.className = 'field-key';
    label.textContent = object.class === undefined ? formatValue(key, renderer.language) : key;
    const content = document.createElement('dd');
    content.className = 'field-content';
    const literal = document.createElement('span');
    literal.className = 'field-value';
    const type = inferType(value, renderer.language);
    literal.innerHTML = renderer.literalHtml(value, type);
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = type;
    content.append(literal, tag);
    row.append(label, content);
    fields.append(row);
  }
  return fields;
}

/** Render each object once, independent of how many variable names reference it. */
export function renderHeap(host: HTMLElement, snap: Snapshot, renderer: ValueRenderer) {
  host.hidden = !snap.heap.length;
  host.replaceChildren();
  if (host.hidden) return;
  const label = document.createElement('h3');
  label.className = 'label';
  label.textContent = 'Objects';
  host.append(label);
  for (const object of snap.heap) {
    const card = document.createElement('article');
    card.className = 'heap-object';
    card.dataset.ref = object.id;
    card.setAttribute('aria-label', 'fields' in object && object.class !== undefined ? `${object.class} instance ${object.id}` : `${'fields' in object ? 'Dictionary' : 'List'} object ${object.id}`);
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
    const cells = 'fields' in object ? renderFields(object, renderer) : renderCollection(object.id, object.value, selected, renderer);
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
.object-fields { margin: 0.5rem 0 0; font-family: var(--ca-font); font-size: 0.85rem; }
.object-field { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: baseline; padding: 0.4rem; border: 1px solid var(--ca-line); }
.object-field + .object-field { margin-top: 0.3rem; }
.field-key { overflow-wrap: anywhere; color: var(--ca-accent); }
.field-content { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem; margin: 0 0 0 auto; min-width: 0; }
.field-value { overflow-wrap: anywhere; }
`;
