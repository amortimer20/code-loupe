import { insertStepForm, duplicateStep, moveStep, newStepForm, deleteStep, editCaption, editDetails, editStep, formOf, prefixSnapshot, readDocument, stepsOf, type Action, type StepForm } from './lesson-document';
import { occurrenceNeeded, renderBuilder, renderUnreadable, stepFields, type Pending } from './builder-view';

import type { LanguageChoice } from './languages';
import { actionDefinitions } from './actions';
import { hasFormChanges, problemStep } from './builder-presentation';
import type { CodeTarget } from './code-target';

interface Host { source(): string; edit(source: string, step: number): void; select(step: number): void; yaml(): void; pick(expressions: boolean): void; cancelPick(): void; canPick(): boolean; languages: readonly LanguageChoice[]; pending(count: number): void }

export function createBuilder(container: HTMLElement, host: Host) {
  let selected = 0, expanded = true;
  let newStep: StepForm | undefined;
  let newPosition = 0, newStepsBase: string | undefined;
  let editingNew = false, newPreviewStep = 0, optionsOpen = false;
  const pending = new Map<number, Pending>();
  // Record exact source transitions so Undo/Redo can follow moved cards even
  // when both neighbors have unsaved forms or identical authored values.
  const moves = new Map<string, Map<string, { from: number; to: number }>>();
  let renderedSource = host.source(), organizeOpen = false;
  const movedIndex = (index: number, from: number, to: number) => index === from ? to : index === to ? from : index;
  function swapPending(from: number, to: number) {
    const left = pending.get(from), right = pending.get(to);
    pending.delete(from); pending.delete(to);
    if (left) pending.set(to, left);
    if (right) pending.set(from, right);
  }
  function rememberMove(before: string, after: string, from: number, to: number) {
    for (const [a, b] of [[before, after], [after, before]]) {
      if (!moves.has(a)) moves.set(a, new Map());
      moves.get(a)!.set(b, { from, to });
    }
  }
  let detailsPending: { base: string; title: string; language: string; code: string } | undefined;
  let detailsOpen = false, problem = '';
  function pendingCount() {
    let count = (newStep ? 1 : 0);
    for (const cache of pending.values()) if (hasFormChanges(JSON.parse(cache.base), cache.values)) count++;
    if (detailsPending) {
      const { base, ...values } = detailsPending;
      if (JSON.stringify(values) !== base) count++;
    }
    return count;
  }
  function syncPending() {
    host.pending(pendingCount());
    container.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(header => {
      const cache = pending.get(Number(header.dataset.step));
      const marker = header.querySelector<HTMLElement>('[data-pending-marker]');
      if (marker) marker.hidden = !cache || !hasFormChanges(JSON.parse(cache.base), cache.values);
    });
  }
  function currentProblemStep() {
    try { return problemStep(problem, stepsOf(readDocument(host.source())).length); } catch { return undefined; }
  }
  function syncProblem() {
    const step = currentProblemStep();
    container.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(header => {
      const invalid = Number(header.dataset.step) + 1 === step;
      header.closest<HTMLElement>('.builder-card')!.dataset.invalid = String(invalid);
      header.querySelector<HTMLElement>('[data-problem-marker]')!.hidden = !invalid;
      if (invalid) header.setAttribute('aria-describedby', 'lesson-error');
      else header.removeAttribute('aria-describedby');
    });
  }

  function revealSelected() {
    const scroller = container.closest<HTMLElement>('#author-scroll');
    const card = container.querySelector<HTMLElement>('.builder-card[data-selected="true"]');
    if (!scroller || !card || !matchMedia('(min-width:961px)').matches) return;
    const pane = scroller.getBoundingClientRect(), box = card.getBoundingClientRect();
    const firstFields = Math.min(box.height, 160, scroller.clientHeight - 16);
    if (box.top >= pane.top + 8 && box.top + firstFields <= pane.bottom - 8) return;
    scroller.scrollTo({ top:scroller.scrollTop + box.top - pane.top - 8,
      behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function revealControl(control: HTMLElement) {
    const scroller = container.closest<HTMLElement>('#author-scroll');
    if (!scroller || !matchMedia('(min-width:961px)').matches) return;
    const pane = scroller.getBoundingClientRect(), box = control.getBoundingClientRect();
    const delta = box.top < pane.top + 8 ? box.top - pane.top - 8 : box.bottom > pane.bottom - 8 ? box.bottom - pane.bottom + 8 : 0;
    if (delta) scroller.scrollTo({ top:scroller.scrollTop + delta,
      behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function syncOccurrence(form: HTMLFormElement, values: StepForm) {
    const field = form.querySelector<HTMLElement>('[data-occurrence]');
    if (!field) return;
    const doc = readDocument(host.source());
    let line = 0;
    try { line = prefixSnapshot(host.source(), selected).line ?? 0; } catch { /* Earlier steps may need repair. */ }
    field.hidden = (values.action === 'convert' && !values.over) || !occurrenceNeeded(values, String(doc.get('code') ?? ''), line);
  }

  /** The preview state before the selected step, and what the host allows, for the form's fields. */
  function fieldsContext() {
    let context: ReturnType<typeof prefixSnapshot> | undefined, contextError = '';
    try { context = prefixSnapshot(host.source(), selected); } catch (error) { contextError = (error as Error).message; }
    const language = String(readDocument(host.source()).get('language') ?? 'python');
    return { context, contextError, language, canPick: host.canPick() };
  }

  function render() {
    host.cancelPick();
    let doc: ReturnType<typeof readDocument>;
    try { doc = readDocument(host.source()); }
    catch (error) {
      container.innerHTML = String(renderUnreadable((error as Error).message));
      syncPending(); return;
    }
    const steps = stepsOf(doc);
    const source = host.source(), move = moves.get(renderedSource)?.get(source);
    if (source !== renderedSource && move) {
      swapPending(move.from, move.to);
      selected = movedIndex(selected, move.from, move.to);
      if (newPreviewStep) newPreviewStep = movedIndex(newPreviewStep - 1, move.from, move.to) + 1;
    }
    renderedSource = source;
    // Undo/Redo can shift saved cards back across an insertion. Follow a unique
    // unchanged YAML step; ambiguous/stale forms keep their guarded original slot.
    let moved: boolean;
    do {
      moved = false;
      for (const [index, cache] of pending) {
        if (JSON.stringify(steps[index]) === cache.base) continue;
        const matches = steps.flatMap((step, target) => JSON.stringify(step) === cache.base ? [target] : []);
        if (matches.length === 1 && !pending.has(matches[0])) {
          pending.delete(index); pending.set(matches[0], cache); moved = true; break;
        }
      }
    } while (moved);
    newPosition = Math.min(newPosition, steps.length);
    selected = editingNew && newStep ? newPosition : Math.max(0, Math.min(selected, steps.length - 1));
    for (const [index, cache] of pending) if (JSON.stringify(steps[index]) === cache.base && !hasFormChanges(steps[index], cache.values)) pending.delete(index);
    const details = { title: String(doc.get('title') ?? ''), language: String(doc.get('language') ?? ''), code: String(doc.get('code') ?? '') };
    const detailsBase = JSON.stringify(details), shown = detailsPending ?? details;
    const staleDetails = detailsPending && detailsPending.base !== detailsBase;
    container.innerHTML = String(renderBuilder({ steps, details, shownDetails: shown, detailsPending: !!detailsPending, staleDetails: !!staleDetails, detailsOpen, languages: host.languages,
      newStep, newPosition, editingNew, selected, expanded, organizeOpen, pending,
      fields: form => stepFields({ form, code: details.code, ...fieldsContext(), optionsOpen }) }));
    container.querySelector('.builder-details')!.addEventListener('toggle', event => { detailsOpen = (event.target as HTMLDetailsElement).open; });
    container.querySelector('.builder-organize')?.addEventListener('toggle', event => { if ((event.target as Element).isConnected && !(event.target as HTMLDetailsElement).open) organizeOpen = false; });
    container.querySelector('.builder-options')?.addEventListener('toggle', event => { if ((event.target as Element).isConnected) optionsOpen = (event.target as HTMLDetailsElement).open; });
    syncProblem(); syncPending();
    const caption = container.querySelector<HTMLTextAreaElement>('[data-step-form] [name="caption"]');
    if (!editingNew && caption && steps[selected] && !pending.has(selected) && !formOf(steps[selected])) caption.value = String(steps[selected]?.caption ?? '');
  }

  function captureItems(values: StepForm, data: Record<string, string>) {
    if (values.kind !== 'List') return;
    values.items = (values.items ?? []).map((item, index) => ({ ...item, kind: (data[`item-kind-${index}`] ?? item.kind) as typeof item.kind, value: data[`item-value-${index}`] ?? item.value }));
  }
  function capture(form: HTMLFormElement): StepForm | { caption: string } {
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const fields = Object.fromEntries(Object.entries(data).filter(([key]) => !key.startsWith('item-')));
    if (form.hasAttribute('data-new-step')) { newStep = { ...newStep!, ...fields }; captureItems(newStep, data); return newStep; }
    const existing = pending.get(selected)?.values ?? formOf(stepsOf(readDocument(host.source()))[selected]);
    const values = existing && 'action' in existing ? { ...existing, ...fields } as StepForm : { caption: data.caption ?? '' };
    if ('action' in values) captureItems(values, data);
    pending.set(selected, { base: form.dataset.base!, values });
    return values;
  }
  function showError(form: HTMLFormElement, error: unknown) {
    const box = form.querySelector<HTMLElement>('.builder-field-error')!;
    box.hidden = false; box.textContent = (error as Error).message;
  }
  container.addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    const form = input.closest('form'); if (!form) return;
    if (form.hasAttribute('data-details')) {
      const values = Object.fromEntries(new FormData(form)) as { title: string; language: string; code: string };
      const doc = readDocument(host.source());
      detailsPending = { base: detailsPending?.base ?? JSON.stringify({ title: String(doc.get('title') ?? ''), language: String(doc.get('language') ?? ''), code: String(doc.get('code') ?? '') }), ...values };
      form.querySelector<HTMLElement>('[data-reload-details]')!.hidden = false;
    } else {
      const values = capture(form);
      if ('action' in values) syncOccurrence(form, values);
      const discard = form.querySelector<HTMLElement>('[data-reload-step]'); if (discard) discard.hidden = false;
      const duplicate = form.querySelector<HTMLButtonElement>('[data-duplicate-step]'); if (duplicate) duplicate.disabled = true;
    }
    const cache = pending.get(selected);
    const dirty = form.hasAttribute('data-new-step') || (form.hasAttribute('data-details') ? !!detailsPending && (() => { const { base, ...values } = detailsPending; return JSON.stringify(values) !== base; })() : !!cache && hasFormChanges(JSON.parse(cache.base), cache.values));
    form.querySelector<HTMLElement>('.builder-form-status')!.textContent = dirty ? 'Unsaved form edits' : '';
    const discard = form.querySelector<HTMLElement>('[data-reload-step], [data-reload-details]'); if (discard) discard.hidden = !dirty;
    if (!dirty && !form.hasAttribute('data-details') && !form.hasAttribute('data-new-step')) pending.delete(selected);
    const duplicate = form.querySelector<HTMLButtonElement>('[data-duplicate-step]'); if (duplicate) duplicate.disabled = !!newStep || dirty;
    syncPending();
  });
  container.addEventListener('change', event => {
    const select = event.target as HTMLSelectElement;
    if (select.tagName !== 'SELECT' || !select.closest('[data-step-form]')) return;
    const form = select.closest('form')!, values = capture(form);
    if (!('action' in values)) return;
    if (select.name === 'action') { values.source = newStepForm(values.action).source; if (values.action === 'input') values.kind = 'Text'; else if (values.kind === 'List' && !actionDefinitions[values.action].listValues) values.kind = 'Number'; else values.kind ||= 'Number'; values.over ||= ''; values.name ||= ''; }
    if (select.name.startsWith('item-kind-')) { const item = values.items?.[Number(select.name.slice(10))]; if (item?.kind === 'Boolean') item.value = 'true'; }
    if (select.name === 'kind' && values.kind === 'List') values.items ??= [];
    if (select.name === 'kind' && values.kind === 'Boolean') values.value = 'true';
    render();
    container.querySelector<HTMLSelectElement>(`[data-step-form] [name="${select.name}"]`)?.focus({ preventScroll:matchMedia('(min-width:961px)').matches });
  });
  container.addEventListener('submit', event => {
    event.preventDefault(); const form = event.target as HTMLFormElement;
    try {
      if (form.hasAttribute('data-details')) {
        const doc = readDocument(host.source());
        const current = JSON.stringify({ title: String(doc.get('title') ?? ''), language: String(doc.get('language') ?? ''), code: String(doc.get('code') ?? '') });
        if (detailsPending && detailsPending.base !== current) throw new Error('Details changed in YAML. Discard details edits before saving.');
        const values = Object.fromEntries(new FormData(form)) as { title: string; language: string; code: string };
        const next = editDetails(host.source(), values); detailsPending = undefined;
        host.edit(next, Math.max(0, selected + 1));
      } else if (form.hasAttribute('data-new-step')) {
        const next = insertStepForm(host.source(), newPosition, capture(form) as StepForm, newStepsBase);
        const shifted = [...pending.entries()].map(([index, value]) => [index >= newPosition ? index + 1 : index, value] as const);
        pending.clear(); shifted.forEach(([index, value]) => pending.set(index, value));
        selected = newPosition;
        newStep = undefined; editingNew = false;
        host.edit(next, selected + 1);
      } else {
        const values = capture(form), next = 'action' in values ? editStep(host.source(), selected, values, form.dataset.base!) : editCaption(host.source(), selected, values.caption, form.dataset.base!);
        pending.delete(selected); host.edit(next, selected + 1);
      }
      render();
      container.querySelector<HTMLButtonElement>(form.hasAttribute('data-details') ? '[data-details] button[type="submit"]' : '[data-step-form] button[type="submit"]')?.focus({ preventScroll:matchMedia('(min-width:961px)').matches });
    } catch (error) { showError(form, error); }
  });
  container.addEventListener('click', event => {
    const button = (event.target as Element).closest('button'); if (!button) return;
    if (button.hasAttribute('data-add-item') || button.hasAttribute('data-remove-item')) {
      const values = capture(button.closest('form')!);
      if ('action' in values) {
        values.items ??= [];
        if (button.hasAttribute('data-add-item')) values.items.push({ kind: 'Number', value: '0' });
        else values.items.splice(Number(button.dataset.removeItem), 1);
        render();
        const add = container.querySelector<HTMLButtonElement>('[data-add-item]');
        add?.focus({ preventScroll: matchMedia('(min-width:961px)').matches });
        if (add) revealControl(add);
      }
      return;
    }
    if (button.hasAttribute('data-pick-code')) {
      if (button.getAttribute('aria-pressed') === 'true') { host.cancelPick(); const message = container.querySelector('[data-code-pick-status]'); if (message) message.textContent = 'Picking cancelled. Your form is unchanged.'; return; }
      const action = button.closest('form')!.querySelector<HTMLSelectElement>('[name="action"]')!.value;
      host.pick(action === 'badge' || action === 'convert');
      return;
    }
    if (button.hasAttribute('data-yaml')) { host.yaml(); return; }
    if (button.hasAttribute('data-new-card')) { expanded = editingNew ? !expanded : true; editingNew = true; optionsOpen = false; render(); container.querySelector<HTMLButtonElement>('[data-new-card]')?.focus({ preventScroll:matchMedia('(min-width:961px)').matches }); revealSelected(); }
    if (button.dataset.step !== undefined) { const same = !editingNew && selected === Number(button.dataset.step); expanded = same ? !expanded : true; organizeOpen = false; selected = Number(button.dataset.step); editingNew = false; optionsOpen = false; render(); if (!same) host.select(selected + 1); container.querySelector<HTMLButtonElement>(`[data-step="${selected}"]`)?.focus({ preventScroll:matchMedia('(min-width:961px)').matches }); revealSelected(); }
    if (button.hasAttribute('data-reload-step')) { pending.delete(selected); render(); container.querySelector<HTMLElement>('[data-step-form] input, [data-step-form] select, [data-step-form] textarea')?.focus({ preventScroll:matchMedia('(min-width:961px)').matches }); }
    if (button.hasAttribute('data-reload-details')) { detailsPending = undefined; render(); container.querySelector<HTMLInputElement>('[data-details] input')?.focus({ preventScroll:matchMedia('(min-width:961px)').matches }); }
    if (button.hasAttribute('data-delete-step')) {
      try {
        const next = deleteStep(host.source(), selected, button.dataset.base!);
        const shifted = [...pending.entries()].filter(([index]) => index !== selected).map(([index, value]) => [index > selected ? index - 1 : index, value] as const);
        pending.clear(); shifted.forEach(([index, value]) => pending.set(index, value));
        selected = Math.max(0, Math.min(selected, stepsOf(readDocument(next)).length - 1));
        host.edit(next, stepsOf(readDocument(next)).length ? selected + 1 : 0); render();
        (container.querySelector<HTMLButtonElement>(`[data-step="${selected}"]`) ?? container.querySelector<HTMLButtonElement>('[data-add]'))?.focus({ preventScroll:matchMedia('(min-width:961px)').matches }); revealSelected();
      } catch (error) { showError(button.closest('form')!, error); }
    }
    if (button.hasAttribute('data-move-step')) {
      try {
        if (newStep) throw new Error('Save or cancel the new card before moving saved steps.');
        const direction = Number(button.dataset.moveStep) as -1 | 1;
        const before = host.source(), from = selected, to = from + direction;
        const next = moveStep(before, from, direction, button.dataset.base!);
        if (next === before && (pending.has(from) || pending.has(to))) throw new Error('These saved steps are identical. Save one card’s edits before swapping them.');
        swapPending(from, to); selected = to; organizeOpen = true;
        if (next !== before) {
          rememberMove(before, next, from, to);
          renderedSource = next; // The explicit move already applied this permutation.
          host.edit(next, selected + 1);
        } else host.select(selected + 1);
        render();
        const same = container.querySelector<HTMLButtonElement>(`[data-move-step="${direction}"]`);
        (same && !same.disabled ? same : container.querySelector<HTMLButtonElement>(`[data-step="${selected}"]`))?.focus({ preventScroll:matchMedia('(min-width:961px)').matches });
        if (same && !same.disabled) revealControl(same); else revealSelected();
      } catch (error) { showError(button.closest('form')!, error); }
    }
    if (button.hasAttribute('data-duplicate-step')) {
      try {
        if (newStep || pending.has(selected)) throw new Error('Save or discard this step’s edits before duplicating it.');
        const next = duplicateStep(host.source(), selected, button.dataset.base!);
        const position = selected + 1;
        const shifted = [...pending.entries()].map(([index, value]) => [index >= position ? index + 1 : index, value] as const);
        pending.clear(); shifted.forEach(([index, value]) => pending.set(index, value));
        selected = position; host.edit(next, selected + 1); render();
        container.querySelector<HTMLButtonElement>(`[data-step="${selected}"]`)?.focus({ preventScroll:matchMedia('(min-width:961px)').matches }); revealSelected();
      } catch (error) { showError(button.closest('form')!, error); }
    }
    if (button.hasAttribute('data-cancel-new')) {
      newStep = undefined; editingNew = false; optionsOpen = false;
      selected = Math.max(0, newPreviewStep - 1); render();
      host.select(newPreviewStep);
      container.querySelector<HTMLButtonElement>('[data-add]')?.focus({ preventScroll:matchMedia('(min-width:961px)').matches });
    }
    if (button.hasAttribute('data-add') || button.hasAttribute('data-insert-step')) {
      if (!newStep) {
        const count = stepsOf(readDocument(host.source())).length;
        newPreviewStep = count ? selected + 1 : 0;
        newPosition = button.hasAttribute('data-insert-step') ? selected + 1 : count;
        newStepsBase = JSON.stringify(stepsOf(readDocument(host.source())));
        newStep = newStepForm(button.hasAttribute('data-insert-step') ? 'highlight' : container.querySelector<HTMLSelectElement>('#builder-new-action')!.value as Action);
        try { newStep.line = String(prefixSnapshot(host.source(), newPosition).line || 1); } catch { /* Validation on Save will explain earlier errors. */ }
      }
      editingNew = true; expanded = true; optionsOpen = false; render();
      container.querySelector<HTMLSelectElement>('[data-new-step] [name="action"]')?.focus({ preventScroll:matchMedia('(min-width:961px)').matches }); revealSelected();
    }
  });
  function applyCodeTarget(target: CodeTarget) {
    const form = container.querySelector<HTMLFormElement>('[data-step-form]');
    if (!form) throw new Error('Select an editable step first.');
    const values = capture(form);
    if (!('action' in values)) throw new Error('Use YAML to change the target of this advanced step.');
    values.line = String(target.line);
    if (target.over !== undefined) { values.over = target.over; values.nth = String(target.nth); }
    render(); revealSelected();
    container.querySelector<HTMLButtonElement>('[data-pick-code]')?.focus({ preventScroll:matchMedia('(min-width:961px)').matches });
    container.querySelector<HTMLElement>('[data-step-form] .builder-form-status')!.textContent = newStep && editingNew || pending.has(selected) ? 'Unsaved form edits' : '';
    syncPending();
  }
  function syncPicking(on = false) {
    const button = container.querySelector<HTMLButtonElement>('[data-pick-code]');
    if (!button) return;
    button.disabled = !on && !host.canPick();
    button.setAttribute('aria-pressed', String(on));
    const label = on ? 'Cancel picking' : 'Pick from preview';
    button.setAttribute('aria-label', label); button.title = on ? `${label} (Escape)` : label;
  }
  function followPreview(step: number, preserveNew = false) {
    if (preserveNew && editingNew) return;
    // Playback reveals cards without replacing a form while someone is typing.
    const active = document.activeElement;
    if (active instanceof Element && container.contains(active) && active.closest('form')) return;
    let count: number;
    try { count = stepsOf(readDocument(host.source())).length; } catch { return; }
    if (!count) return;
    const target = Math.max(0, Math.min(count - 1, step - 1));
    if (!editingNew && selected === target) return;
    selected = target; editingNew = false; optionsOpen = false;
    render(); revealSelected();
  }
  render();
  function goToStep(step: number) {
    let count: number;
    try { count = stepsOf(readDocument(host.source())).length; } catch { return false; }
    if (!Number.isInteger(step) || step < 1 || step > count) return false;
    selected = step - 1; editingNew = false; expanded = true; organizeOpen = false;
    render();
    container.querySelector<HTMLButtonElement>(`[data-step="${selected}"]`)?.focus({ preventScroll:matchMedia('(min-width:961px)').matches });
    revealSelected(); return true;
  }
  return { goToStep, pendingCount, setProblem(message: string) { problem = message; syncProblem(); return currentProblemStep(); }, followPreview, applyCodeTarget, syncPicking, reset() { moves.clear(); renderedSource = host.source(); organizeOpen = false; pending.clear(); newStep = undefined; editingNew = false; optionsOpen = false; detailsPending = undefined; selected = 0; expanded = true; render(); }, refresh: render, revealSelected, selectedStep: () => Math.max(0, editingNew ? newPreviewStep : selected + 1) };
}
