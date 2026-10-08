import type { Value } from '../lesson';
import type { VarState } from '../state';
import { formatValue, isReference } from '../values';
import { renderCollection } from './collection';
import type { CollectionSelection } from './collection-state';

export interface ValueRenderer {
  language: string;
  literalHtml: (value: Value, type: string) => string;
}

/** Shared variable rows for globals and function-local variables. */
export function renderVariables(host: HTMLElement, vars: VarState[], renderer: ValueRenderer, selection?: CollectionSelection | null, frameId = 0) {
  host.replaceChildren(...vars.map(v => {
    const row = document.createElement('div');
    row.className = 'var';
    row.dataset.name = v.name;
    row.classList.toggle('has-collection', Array.isArray(v.value));
    for (const [className, text] of [['name', v.name], ['eq', '='], ['value', ''], ['tag', v.type]]) {
      const span = document.createElement('span');
      span.className = className;
      if (className === 'value' && isReference(v.value)) {
        span.classList.add('reference');
        row.dataset.ref = v.value.ref;
        span.textContent = `→ ${v.value.ref}`;
      }
      else if (className === 'value' && Array.isArray(v.value)) {
        const selected = selection?.name === v.name && selection.frameId === frameId ? selection.index : undefined;
        span.append(renderCollection(v.name, v.value, selected, renderer));
      }
      else if (className === 'value' && !isReference(v.value)) span.innerHTML = renderer.literalHtml(v.value, v.type);
      else span.textContent = text;
      row.append(span);
    }
    row.setAttribute('aria-label', isReference(v.value) ? `${v.name} points to ${v.type === 'dict' || v.type === 'object' ? 'dictionary' : 'list'} object ${v.value.ref}` : `${v.name} is the ${v.type} ${formatValue(v.value, renderer.language, v.type)}`);
    return row;
  }));
}
