import { insertStepForm, duplicateStep, moveStep, newStepForm, deleteStep, actionLabels, editCaption, editDetails, editStep, formOf, prefixSnapshot, readDocument, badgeSources, listBindings, latestConsoleInput, stepsOf, type Action, type StepForm } from './lesson-document';

import { languageChoices, type LanguageChoice } from './languages';
import { findNth } from 'code-loupe/state';
import { badgeDisplay, hasFormChanges, problemStep, stepSummary, storedDisplay } from './builder-presentation';
import { formatValue } from '../../../../packages/player/src/values';
import type { CodeTarget } from './code-target';

interface Host { source(): string; edit(source: string, step: number): void; select(step: number): void; yaml(): void; pick(expressions: boolean): void; cancelPick(): void; canPick(): boolean; languages: readonly LanguageChoice[]; pending(count: number): void }
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const option = (value: string, label: string, selected: string) => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(label)}</option>`;
const field = (name: string, label: string, value: string, type = 'text') => `<label>${label}<input name="${name}" type="${type}" aria-label="${label}" ${type === 'number' ? 'step="any"' : ''} value="${escape(value)}"></label>`;
const captionField = (value: string) => `<label>Caption<textarea aria-label="Caption" name="caption" rows="3">${escape(value)}</textarea></label>`;
const errorBox = '<p class="builder-field-error" role="alert" hidden></p>';
function stepActions(isNew: boolean, dirty: boolean, base: string) {
  const secondary = isNew
    ? '<button type="button" data-cancel-new>Cancel new step</button>'
    : `<button type="button" data-reload-step ${dirty ? '' : 'hidden'}>Discard edits</button>`;
  const deletion = isNew ? '' : `<button type="button" class="builder-delete" data-delete-step data-base="${escape(base)}" title="Undo restores a deleted step. Later steps may need repair.">Delete step</button>`;
  return `<div class="builder-action-row"><div class="builder-save-actions"><button class="builder-primary" type="submit">Save step</button>${secondary}</div>${deletion}</div><span class="builder-form-status" role="status"></span>`;
}
interface Pending { base: string; values: StepForm | { caption: string } }

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

  function valueFields(form: StepForm) {
    const kind = `<label>Value type<select aria-label="Value type" name="kind">${(form.action === 'badge' || form.action === 'assign' ? ['Number', 'Text', 'Boolean', 'None', 'List'] : ['Number', 'Text', 'Boolean', 'None']).map(value => option(value, value, form.kind)).join('')}</select></label>`;
    if (form.kind === 'List') return `${kind}<div class="builder-list-items">${(form.items ?? []).map((item, index) => `<div class="builder-fields"><label>Item ${index} type<select name="item-kind-${index}" aria-label="Item ${index} type">${['Number', 'Text', 'Boolean', 'None'].map(type => option(type, type, item.kind)).join('')}</select></label>${item.kind === 'None' ? '<span>None</span>' : item.kind === 'Boolean' ? `<label>Item ${index} value<select name="item-value-${index}" aria-label="Item ${index} value">${option('true', 'True', item.value)}${option('false', 'False', item.value)}</select></label>` : field(`item-value-${index}`, `Item ${index} value`, item.value)}<button type="button" data-remove-item="${index}">Remove item ${index}</button></div>`).join('')}<button type="button" data-add-item>Add list item</button><p class="builder-note">Items are numbered from 0. Empty lists are allowed; nested lists are not supported.</p></div>`;
    const value = form.kind === 'None'  ? '<label>Value<input value="None" disabled></label>'
      : form.kind === 'Boolean' ? `<label>Value<select aria-label="Value" name="value">${option('true', 'True', form.value)}${option('false', 'False', form.value)}</select></label>`
      : field('value', 'Value', form.value); // Text input preserves incomplete numeric entries.
    return `<div class="builder-fields">${kind}${value}</div>`;
  }

  function occurrenceNeeded(form: StepForm, code: string, currentLine: number) {
    const line = code.split('\n')[Number(form.line || currentLine) - 1] ?? '';
    return form.nth !== '1' || (!!form.over && findNth(line, form.over, 2) >= 0);
  }

  function syncOccurrence(form: HTMLFormElement, values: StepForm) {
    const field = form.querySelector<HTMLElement>('[data-occurrence]');
    if (!field) return;
    const doc = readDocument(host.source());
    let line = 0;
    try { line = prefixSnapshot(host.source(), selected).line ?? 0; } catch { /* Earlier steps may need repair. */ }
    field.hidden = (values.action === 'convert' && !values.over) || !occurrenceNeeded(values, String(doc.get('code') ?? ''), line);
  }

  function stepFields(form: StepForm, code: string) {
    let context: ReturnType<typeof prefixSnapshot> | undefined, contextError = '';
    try { context = prefixSnapshot(host.source(), selected); } catch (error) { contextError = (error as Error).message; }
    const language = String(readDocument(host.source()).get('language') ?? 'python');
    const display = (value: Parameters<typeof formatValue>[0], type?: string) => formatValue(value, language, type);
    const lines = code.replace(/\n+$/, '').split('\n');
    const choices = lines.map((text, index) => option(String(index + 1), `${index + 1} · ${text.trim()}`, form.line));
    if (form.line && !choices.some((_choice, index) => String(index + 1) === form.line)) choices.push(option(form.line, `${form.line} · check this line`, form.line));
    let html = `<div class="builder-fields"><label>Step action<select aria-label="Step action" name="action">${Object.entries(actionLabels).map(([key, label]) => option(key, label, form.action)).join('')}</select></label><div class="builder-line-field"><label for="builder-code-line">Code line</label><div class="builder-code-target" role="group" aria-label="Line targeting"><select id="builder-code-line" aria-label="Code line" name="line">${option('', 'Keep current line', form.line)}${choices.join('')}</select><button type="button" class="builder-pick" data-pick-code aria-label="Pick from preview" title="Pick from preview" aria-pressed="false" ${host.canPick() ? '' : 'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg></button></div></div></div>`;
    html += `<p class="builder-note" data-code-pick-status role="status"></p>`;
    if (form.action === 'badge') {
      const vars = context ? badgeSources(context) : [];
      const source = vars.find(variable => variable.name === form.source);
      if (form.source !== 'literal' && form.source !== 'console' && !vars.some(variable => variable.name === form.source)) html += '<p class="builder-note">This source needs a valid earlier step. Its current value cannot be filled yet.</p>';
      html += `<div class="builder-fields">${field('over', 'Expression text', form.over)}<div data-occurrence ${occurrenceNeeded(form, code, context?.line ?? 0) ? '' : 'hidden'}>${field('nth', 'Occurrence', form.nth)}</div><label>Value source<select aria-label="Value source" name="source">${option('literal', 'Enter a value', form.source)}${option('console', 'Latest console input', form.source)}${vars.map(variable => option(variable.name, `Variable: ${variable.name} = ${display(variable.value, variable.type)}`, form.source)).join('')}${form.source !== 'literal' && form.source !== 'console' && !vars.some(variable => variable.name === form.source) ? option(form.source, `Variable: ${form.source}`, form.source) : ''}</select></label></div>`;
      html += form.source === 'literal' ? valueFields(form) : form.source === 'console'
        ? `<p class="builder-note">${context && latestConsoleInput(context) !== undefined ? `Latest entered text: ${escape(JSON.stringify(latestConsoleInput(context)))}` : 'No earlier entered text is available.'} Saving fills a text value from that authored input.</p>`
        : `<p class="builder-note">${source ? `Current value: ${escape(display(source.value, source.type))}. ` : ''}Save fills this read from earlier authored steps.</p>`;
    }
    if (form.action === 'badge') {
      const elements = context ? badgeSources(context).filter(item => item.name.endsWith(']')) : [];
      if (elements.length || form.selection || context?.selection) html += `<label>List selection<select aria-label="List selection" name="selection">${option('', 'Keep current selection', form.selection ?? '')}${option('clear', 'Clear selection', form.selection ?? '')}${elements.map(item => option(item.name, `${item.name} = ${display(item.value)}`, form.selection ?? '')).join('')}${form.selection && form.selection !== 'clear' && !elements.some(item => item.name === form.selection) ? option(form.selection, `${form.selection} · unavailable`, form.selection) : ''}</select></label>`;
    }
    if (['select', 'update', 'remove'].includes(form.action)) {
      const elements = context ? badgeSources(context).filter(item => item.name.endsWith(']')) : [];
      html += `<label>List element<select aria-label="List element" name="name">${option('', form.action === 'select' ? 'Clear selection' : 'Choose an element', form.name)}${elements.map(item => option(item.name, `${item.name} = ${display(item.value)}`, form.name)).join('')}${form.name && !elements.some(item => item.name === form.name) ? option(form.name, `${form.name} · unavailable`, form.name) : ''}</select></label>`;
    }
    if (form.action === 'append') {
      const lists = context ? listBindings(context) : [];
      html += `<label>List<select aria-label="List" name="name">${option('', 'Choose a list', form.name)}${lists.map(variable => option(variable.name, `${variable.name} = ${storedDisplay(context!, variable.value, language, variable.type)}`, form.name)).join('')}${form.name && !lists.some(variable => variable.name === form.name) ? option(form.name, `${form.name} · unavailable`, form.name) : ''}</select></label><p class="builder-note">Adds one item at the end, including when the list is empty.</p>`;
    }
    if (form.action === 'remove') html += '<p class="builder-note">Deletes by index, as Python del does. Later items shift down one index; no result badge is created.</p>';
    if (['assign', 'update', 'append'].includes(form.action)) {
      html += `<div class="builder-fields">${form.action === 'assign' ? field('name', 'Variable name', form.name) : ''}<label>Value source<select aria-label="Value source" name="source">${option('literal', 'Enter a value', form.source)}${option('badge', 'Latest badge', form.source)}</select></label></div>`;
      if (form.source === 'literal') html += valueFields(form);
    }
    if (['print', 'write'].includes(form.action)) {
      html += `<label>Output source<select aria-label="Output source" name="source">${option('literal', 'Enter output text', form.source)}${option('badge', 'Latest badge', form.source)}</select></label>`;
      if (form.action === 'write') html += '<p class="builder-note">Writes without a newline, so entered text can follow the prompt on the same line. Include any trailing space you want.</p>';
      html += `<label>Output text<textarea aria-label="Output text" name="value" rows="2">${escape(form.value)}</textarea></label>`;
    }
    if (form.action === 'input') html += `<label>Entered text<textarea aria-label="Entered text" name="value" rows="2">${escape(form.value)}</textarea></label><p class="builder-note">Text the teacher chooses for this explanation, including digits or empty input. Students are stepping through an authored response.</p>`;
    if (form.action === 'convert') {
      html += `<div class="builder-fields">${field('over', 'Result expression (optional)', form.over)}<div data-occurrence ${form.over && occurrenceNeeded(form, code, context?.line ?? 0) ? '' : 'hidden'}>${field('nth', 'Occurrence', form.nth)}</div></div><p class="builder-note">Leave the expression blank to keep the badge in place. Enter the converted result below; no conversion code is executed.</p>${valueFields(form)}`;
    }
    if (form.source === 'badge') {
      const changedLine = form.line && Number(form.line) !== context?.line;
      const badge = changedLine ? undefined : context?.badges.at(-1);
      const hint = form.action === 'assign' ? 'Stores this value in the variable.'
        : form.action === 'update' ? 'Replaces the selected list element.'
        : form.action === 'append' ? 'Adds this value at the end of the list.'
        : ['print', 'write'].includes(form.action) ? 'Output text must contain this badge’s printed value.' : '';
      html += `<p class="builder-note">Latest badge: ${escape(badge && context ? badgeDisplay(context, badge, language) : 'none on this line')}. ${hint}</p>`;
    }
    if (contextError) html += `<p class="builder-note">Earlier state needs repair: ${escape(contextError)}</p>`;
    if (['badge', 'assign', 'convert'].includes(form.action) && (form.source === 'literal' || form.action === 'convert') && form.kind === 'Number') {
      html += `<details class="builder-options" ${optionsOpen || form.numericType !== 'auto' ? 'open' : ''}><summary>Optional settings</summary><label>Number display<select aria-label="Number display" name="numericType">${option('auto', 'Automatic', form.numericType)}${option('int', 'Integer', form.numericType)}${option('float', 'Float (e.g. 5.0)', form.numericType)}</select></label></details>`;
    }
    return html + captionField(form.caption) + errorBox;
  }

  function render() {
    host.cancelPick();
    let doc: ReturnType<typeof readDocument>;
    try { doc = readDocument(host.source()); }
    catch (error) {
      container.innerHTML = `<p role="alert">${escape((error as Error).message)}</p><button type="button" data-yaml>Open YAML</button>`;
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
    const cards = [...steps];
    if (newStep) cards.splice(newPosition, 0, {});
    const details = { title: String(doc.get('title') ?? ''), language: String(doc.get('language') ?? ''), code: String(doc.get('code') ?? '') };
    const detailsBase = JSON.stringify(details), shown = detailsPending ?? details;
    const staleDetails = detailsPending && detailsPending.base !== detailsBase;
    container.innerHTML = `<details class="builder-details" ${detailsOpen ? 'open' : ''}><summary>Lesson details · ${escape(details.language)}</summary><form data-details><label>Title<input name="title" value="${escape(shown.title)}"></label><label>Language<select name="language" aria-label="Language">${languageChoices(host.languages, shown.language).map(choice => option(choice.id, choice.name, shown.language)).join('')}</select></label><p class="builder-note">Language controls syntax highlighting and value formatting. You still author the steps.</p><label>Displayed code<textarea aria-label="Displayed code" name="code" rows="5" spellcheck="false" class="builder-code">${escape(shown.code)}</textarea></label>${errorBox}<div class="builder-apply"><button type="submit">Save lesson details</button><button type="button" data-reload-details ${detailsPending ? '' : 'hidden'}>Discard details edits</button><span class="builder-form-status" role="status">${staleDetails ? 'YAML changed; discard details edits before saving.' : detailsPending ? 'Unsaved form edits' : ''}</span></div></form></details>
      <div class="builder-heading"><h3>Teaching steps</h3><span>${steps.length} saved steps${newStep ? " · 1 new" : ""}</span></div>
      <div class="builder-cards">${cards.map((step, position) => {
        const isNew = !!newStep && position === newPosition;
        const index = newStep && position > newPosition ? position - 1 : position;
        const base = JSON.stringify(step), cache = isNew ? undefined : pending.get(index), form = isNew ? newStep : cache?.values ?? formOf(step), supported = form && 'action' in form;
        const current = isNew ? editingNew : !editingNew && index === selected;
        return `<article class="builder-card" data-selected="${current}"><button type="button" class="builder-step" ${isNew ? 'data-new-card' : `data-step="${index}"`} aria-current="${current ? 'step' : 'false'}" aria-expanded="${current && expanded}" aria-controls="builder-step-panel-${position}"><span class="builder-number">${isNew ? '+' : index + 1}</span><span>${escape(isNew ? `New · ${actionLabels[newStep!.action]}` : stepSummary(step, details.language))}</span><small>${step.line === undefined ? '' : `Line ${escape(step.line)}`}${isNew ? 'Not saved' : `<span data-pending-marker ${cache ? '' : 'hidden'}> · Unsaved</span>`}</small><small data-problem-marker hidden>Needs attention</small><svg class="builder-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button><div id="builder-step-panel-${position}" ${current && expanded ? '' : 'hidden'}>${current && expanded ? `<form data-step-form ${isNew ? 'data-new-step' : ''} data-base="${escape(cache?.base ?? base)}">${supported ? stepFields(form as StepForm, details.code) : `<p class="builder-note">This action is preserved. Edit its caption here, or open YAML for other fields.</p><button type="button" data-yaml>Open this step in YAML</button>${captionField(cache?.values.caption ?? String(step.caption ?? ''))}${errorBox}`}${stepActions(isNew, !!cache, base)}${isNew ? '<p class="builder-note">This card is not in your YAML yet. Save inserts it here; Cancel drops it.</p>' : `<details class="builder-organize" ${organizeOpen ? 'open' : ''}><summary>Organize step</summary><div class="builder-step-actions"><button type="button" data-move-step="-1" data-base="${escape(base)}" ${newStep || index === 0 ? 'disabled' : ''}>Move up</button><button type="button" data-move-step="1" data-base="${escape(base)}" ${newStep || index === steps.length - 1 ? 'disabled' : ''}>Move down</button><button type="button" data-insert-step ${newStep ? 'disabled' : ''}>Insert after this step</button><button type="button" data-duplicate-step data-base="${escape(base)}" ${newStep || cache ? 'disabled' : ''}>Duplicate step</button></div><p class="builder-note">Duplicate copies the saved step. Save or discard its edits first. Later steps may need repair.</p></details>`}</form>` : ''}</div></article>`;
      }).join('')}</div>
      <div class="builder-add" ${editingNew ? 'hidden' : ''}><label ${newStep ? 'hidden' : ''}>New step<select aria-label="New step" id="builder-new-action" ${newStep ? 'disabled' : ''}>${Object.entries(actionLabels).map(([key, label]) => option(key, label, 'highlight')).join('')}</select></label><button class="builder-primary" type="button" data-add>${newStep ? 'Edit new step' : 'Add step'}</button></div>
      <p class="builder-note">Save puts form edits into your browser draft and updates the preview. Discard drops unsaved form edits; Undo reverses saved edits. Teachers choose the outcomes; the displayed code does not run.</p>`;
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
    if (select.name === 'action') { values.source = values.action === 'convert' ? 'badge' : 'literal'; if (values.action === 'input') values.kind = 'Text'; else if (values.kind === 'List' && !['assign', 'badge'].includes(values.action)) values.kind = 'Number'; else values.kind ||= 'Number'; values.over ||= ''; values.name ||= ''; }
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
