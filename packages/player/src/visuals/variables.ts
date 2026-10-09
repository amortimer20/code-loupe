import type { Value } from '../lesson';
import type { VarState } from '../state';
import { formatValue, isReference } from '../values';

export interface ValueRenderer {
  language: string;
  literalHtml: (value: Value, type: string) => string;
}

/** Shared variable rows for globals and function-local variables. */
export function renderVariables(host: HTMLElement, vars: VarState[], renderer: ValueRenderer) {
  host.replaceChildren(...vars.map(v => {
    const row = document.createElement('div');
    row.className = 'var';
    row.dataset.name = v.name;
    for (const [className, text] of [['name', v.name], ['eq', '='], ['value', ''], ['tag', v.type]]) {
      const span = document.createElement('span');
      span.className = className;
      if (className === 'value' && isReference(v.value)) {
        span.classList.add('reference');
        row.dataset.ref = v.value.ref;
        span.textContent = `→ ${v.value.ref}`;
      }
      else if (className === 'value' && !isReference(v.value)) span.innerHTML = renderer.literalHtml(v.value, v.type);
      else span.textContent = text;
      row.append(span);
    }
    row.setAttribute('aria-label', isReference(v.value) ? `${v.name} points to object ${v.value.ref}` : `${v.name} is the ${v.type} ${formatValue(v.value, renderer.language, v.type)}`);
    return row;
  }));
}
