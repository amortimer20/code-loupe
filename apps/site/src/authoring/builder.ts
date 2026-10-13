import { appendStepForm, newStepForm, deleteStep, actionLabels, editCaption, editDetails, editStep, formOf, prefixSnapshot, readDocument, scalarBindings, stepsOf, type Action, type StepForm } from './lesson-document';

import { languageChoices, type LanguageChoice } from './languages';
import { findNth } from 'code-loupe/state';
import type { CodeTarget } from './code-target';

interface Host { source(): string; edit(source: string, step: number): void; select(step: number): void; yaml(): void; pick(expressions: boolean): void; cancelPick(): void; canPick(): boolean; languages: readonly LanguageChoice[] }
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const option = (value: string, label: string, selected: string) => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(label)}</option>`;
const field = (name: string, label: string, value: string, type = 'text') => `<label>${label}<input name="${name}" type="${type}" aria-label="${label}" ${type === 'number' ? 'step="any"' : ''} value="${escape(value)}"></label>`;
const captionField = (value: string) => `<label>Caption<textarea aria-label="Caption" name="caption" rows="3">${escape(value)}</textarea></label>`;
const errorBox = '<p class="builder-field-error" role="alert" hidden></p>';
const applyButton = '<button class="builder-primary" type="submit">Save step</button><span class="builder-form-status" role="status"></span>';
interface Pending { base: string; values: StepForm | { caption: string } }

export function createBuilder(container: HTMLElement, host: Host) {
  let selected = 0;
  let newStep: StepForm | undefined;
  let editingNew = false, newPreviewStep = 0, optionsOpen = false;
  const pending = new Map<number, Pending>();
  let detailsPending: { base: string; title: string; language: string; code: string } | undefined;
  let detailsOpen = false;

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

  function summary(step: Record<string, unknown>) {
    const form = formOf(step);
    if (!form) return `Advanced · ${Object.keys(step).filter(key => !['line', 'caption'].includes(key)).join(', ') || 'YAML'}`;
    if (form.action === 'badge') return form.source === 'literal' ? `Show ${form.kind === 'Text' ? JSON.stringify(form.value) : form.kind === 'None' ? 'None' : form.value}` : `Read ${form.source}`;
    if (form.action === 'assign') return `Store a value in ${form.name || 'a variable'}`;
    if (form.action === 'print') return form.source === 'badge' ? 'Print the latest badge' : `Print ${JSON.stringify(form.value)}`;
    return form.line ? `Highlight line ${form.line}` : 'Explain the current moment';
  }

  function valueFields(form: StepForm) {
    const kind = `<label>Value type<select aria-label="Value type" name="kind">${['Number', 'Text', 'Boolean', 'None'].map(value => option(value, value, form.kind)).join('')}</select></label>`;
    const value = form.kind === 'None' ? '<label>Value<input value="None" disabled></label>'
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
    field.hidden = !occurrenceNeeded(values, String(doc.get('code') ?? ''), line);
  }

  function stepFields(form: StepForm, code: string) {
    let context: ReturnType<typeof prefixSnapshot> | undefined, contextError = '';
    try { context = prefixSnapshot(host.source(), selected); } catch (error) { contextError = (error as Error).message; }
    const lines = code.replace(/\n+$/, '').split('\n');
    const choices = lines.map((text, index) => option(String(index + 1), `${index + 1} · ${text.trim()}`, form.line));
    if (form.line && !choices.some((_choice, index) => String(index + 1) === form.line)) choices.push(option(form.line, `${form.line} · check this line`, form.line));
    let html = `<div class="builder-fields"><label>Step action<select aria-label="Step action" name="action">${Object.entries(actionLabels).map(([key, label]) => option(key, label, form.action)).join('')}</select></label><label>Code line<select aria-label="Code line" name="line">${option('', 'Keep current line', form.line)}${choices.join('')}</select></label></div>`;
    html += `<button type="button" class="builder-pick" data-pick-code aria-pressed="false" ${host.canPick() ? '' : 'disabled'}>Pick from preview</button><p class="builder-note" data-code-pick-status role="status"></p>`;
    if (form.action === 'badge') {
      const vars = context ? scalarBindings(context) : [];
      if (form.source !== 'literal' && !vars.some(variable => variable.name === form.source)) html += '<p class="builder-note">This source needs a valid earlier step. Its current value cannot be filled yet.</p>';
      html += `<div class="builder-fields">${field('over', 'Expression text', form.over)}<div data-occurrence ${occurrenceNeeded(form, code, context?.line ?? 0) ? '' : 'hidden'}>${field('nth', 'Occurrence', form.nth)}</div><label>Value source<select aria-label="Value source" name="source">${option('literal', 'Enter a value', form.source)}${vars.map(variable => option(variable.name, `Variable: ${variable.name}`, form.source)).join('')}${form.source !== 'literal' && !vars.some(variable => variable.name === form.source) ? option(form.source, `Variable: ${form.source}`, form.source) : ''}</select></label></div>`;
      html += form.source === 'literal' ? valueFields(form) : '<p class="builder-note">Saving fills the value from the authored state before this step. It does not execute the code.</p>';
    }
    if (form.action === 'assign') {
      html += `<div class="builder-fields">${field('name', 'Variable name', form.name)}<label>Value source<select aria-label="Value source" name="source">${option('literal', 'Enter a value', form.source)}${option('badge', 'Latest badge', form.source)}</select></label></div>`;
      if (form.source === 'literal') html += valueFields(form);
    }
    if (form.action === 'print') {
      html += `<label>Output source<select aria-label="Output source" name="source">${option('literal', 'Enter output text', form.source)}${option('badge', 'Latest badge', form.source)}</select></label>`;
      html += `<label>Output text<textarea aria-label="Output text" name="value" rows="2">${escape(form.value)}</textarea></label>`;
    }
    if (form.source === 'badge') {
      const changedLine = form.line && Number(form.line) !== context?.line;
      const badge = changedLine ? undefined : context?.badges.at(-1);
      const value = badge && typeof badge.value !== 'object' ? JSON.stringify(badge.value) : badge?.value === null ? 'None' : badge ? `a ${badge.type} value` : 'none on this line';
      html += `<p class="builder-note">Latest badge: ${escape(value)}. Printing must use a separate step from creating a badge.</p>`;
    }
    if (contextError) html += `<p class="builder-note">Earlier state needs repair: ${escape(contextError)}</p>`;
    if (['badge', 'assign'].includes(form.action) && form.source === 'literal' && form.kind === 'Number') {
      html += `<details class="builder-options" ${optionsOpen || form.numericType !== 'auto' ? 'open' : ''}><summary>Optional settings</summary><label>Number display<select aria-label="Number display" name="numericType">${option('auto', 'Automatic', form.numericType)}${option('int', 'Integer', form.numericType)}${option('float', 'Float (e.g. 5.0)', form.numericType)}</select></label></details>`;
    }
    return html + captionField(form.caption) + errorBox + `<div class="builder-apply">${applyButton}</div>`;
  }

  function render() {
    host.cancelPick();
    let doc: ReturnType<typeof readDocument>;
    try { doc = readDocument(host.source()); }
    catch (error) {
      container.innerHTML = `<p role="alert">${escape((error as Error).message)}</p><button type="button" data-yaml>Open YAML</button>`;
      return;
    }
    const steps = stepsOf(doc);
    selected = editingNew && newStep ? steps.length : Math.max(0, Math.min(selected, steps.length - 1));
    const cards = newStep ? [...steps, {}] : steps;
    const details = { title: String(doc.get('title') ?? ''), language: String(doc.get('language') ?? ''), code: String(doc.get('code') ?? '') };
    const detailsBase = JSON.stringify(details), shown = detailsPending ?? details;
    const staleDetails = detailsPending && detailsPending.base !== detailsBase;
    container.innerHTML = `<details class="builder-details" ${detailsOpen ? 'open' : ''}><summary>Lesson details · ${escape(details.language)}</summary><form data-details><label>Title<input name="title" value="${escape(shown.title)}"></label><label>Language<select name="language" aria-label="Language">${languageChoices(host.languages, shown.language).map(choice => option(choice.id, choice.name, shown.language)).join('')}</select></label><p class="builder-note">Language controls syntax highlighting and value formatting. You still author the steps.</p><label>Displayed code<textarea aria-label="Displayed code" name="code" rows="5" spellcheck="false" class="builder-code">${escape(shown.code)}</textarea></label>${errorBox}<div class="builder-apply"><button type="submit">Save lesson details</button><button type="button" data-reload-details ${detailsPending ? '' : 'hidden'}>Discard details edits</button><span class="builder-form-status" role="status">${staleDetails ? 'YAML changed; discard details edits before saving.' : detailsPending ? 'Unsaved form edits' : ''}</span></div></form></details>
      <div class="builder-heading"><h3>Teaching steps</h3><span>${steps.length} saved steps${newStep ? " · 1 new" : ""}</span></div>
      <div class="builder-cards">${cards.map((step, index) => {
        const isNew = !!newStep && index === steps.length;
        const base = JSON.stringify(step), cache = isNew ? undefined : pending.get(index), form = isNew ? newStep : cache?.values ?? formOf(step), supported = form && 'action' in form;
        const current = index === selected;
        return `<article class="builder-card" data-selected="${current}"><button type="button" class="builder-step" data-step="${index}" aria-expanded="${current}"><span class="builder-number">${index + 1}</span><span>${escape(isNew ? `New · ${actionLabels[newStep!.action]}` : summary(step))}</span><small>${step.line === undefined ? '' : `Line ${escape(step.line)}`}${isNew ? 'Not saved' : cache ? ' · Unsaved' : ''}</small></button>${current ? `<form data-step-form ${isNew ? 'data-new-step' : ''} data-base="${escape(cache?.base ?? base)}">${supported ? stepFields(form as StepForm, details.code) : `<p class="builder-note">This action is preserved. Edit its caption here, or open YAML for other fields.</p><button type="button" data-yaml>Open this step in YAML</button>${captionField(cache?.values.caption ?? String(step.caption ?? ''))}${errorBox}<div class="builder-apply">${applyButton}</div>`}${isNew ? '<button type="button" class="builder-reload" data-cancel-new>Cancel new step</button><p class="builder-note">This card is not in your YAML yet. Save adds it; Cancel drops it.</p>' : `<button type="button" class="builder-reload" data-reload-step ${cache ? '' : 'hidden'}>Discard step edits</button><button type="button" class="builder-delete" data-delete-step data-base="${escape(base)}" title="Undo restores a deleted step. Later steps may need repair.">Delete step</button>`}</form>` : ''}</article>`;
      }).join('')}</div>
      <div class="builder-add" ${editingNew ? 'hidden' : ''}><label ${newStep ? 'hidden' : ''}>New step<select aria-label="New step" id="builder-new-action" ${newStep ? 'disabled' : ''}>${Object.entries(actionLabels).map(([key, label]) => option(key, label, 'highlight')).join('')}</select></label><button class="builder-primary" type="button" data-add>${newStep ? 'Edit new step' : 'Add step'}</button></div>
      <p class="builder-note">Save puts form edits into your browser draft and updates the preview. Discard drops unsaved form edits; Undo reverses saved edits. Teachers choose the outcomes; the displayed code does not run.</p>`;
    container.querySelector('.builder-details')!.addEventListener('toggle', event => { detailsOpen = (event.target as HTMLDetailsElement).open; });
    container.querySelector('.builder-options')?.addEventListener('toggle', event => { if ((event.target as Element).isConnected) optionsOpen = (event.target as HTMLDetailsElement).open; });
    const caption = container.querySelector<HTMLTextAreaElement>('[data-step-form] [name="caption"]');
    if (!editingNew && caption && steps[selected] && !pending.has(selected) && !formOf(steps[selected])) caption.value = String(steps[selected]?.caption ?? '');
  }

  function capture(form: HTMLFormElement): StepForm | { caption: string } {
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (form.hasAttribute('data-new-step')) { newStep = { ...newStep!, ...data }; return newStep; }
    const existing = pending.get(selected)?.values ?? formOf(stepsOf(readDocument(host.source()))[selected]);
    const values = existing && 'action' in existing ? { ...existing, ...data } as StepForm : { caption: data.caption ?? '' };
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
    }
    form.querySelector<HTMLElement>('.builder-form-status')!.textContent = 'Unsaved form edits';
  });
  container.addEventListener('change', event => {
    const select = event.target as HTMLSelectElement;
    if (select.tagName !== 'SELECT' || !select.closest('[data-step-form]')) return;
    const form = select.closest('form')!, values = capture(form);
    if (!('action' in values)) return;
    if (select.name === 'action') { values.source = 'literal'; values.kind ||= 'Number'; values.over ||= ''; values.name ||= ''; }
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
        const next = appendStepForm(host.source(), capture(form) as StepForm);
        selected = stepsOf(readDocument(next)).length - 1;
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
    if (button.hasAttribute('data-pick-code')) {
      if (button.getAttribute('aria-pressed') === 'true') { host.cancelPick(); const message = container.querySelector('[data-code-pick-status]'); if (message) message.textContent = 'Picking cancelled. Your form is unchanged.'; return; }
      const action = button.closest('form')!.querySelector<HTMLSelectElement>('[name="action"]')!.value;
      host.pick(action === 'badge');
      return;
    }
    if (button.hasAttribute('data-yaml')) { host.yaml(); return; }
    if (button.dataset.step !== undefined) { selected = Number(button.dataset.step); editingNew = !!newStep && selected === stepsOf(readDocument(host.source())).length; optionsOpen = false; render(); if (!editingNew) host.select(selected + 1); container.querySelector<HTMLButtonElement>(`[data-step="${selected}"]`)?.focus({ preventScroll:matchMedia('(min-width:961px)').matches }); revealSelected(); }
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
    if (button.hasAttribute('data-cancel-new')) {
      newStep = undefined; editingNew = false; optionsOpen = false;
      selected = Math.max(0, newPreviewStep - 1); render();
      host.select(newPreviewStep);
      container.querySelector<HTMLButtonElement>('[data-add]')?.focus({ preventScroll:matchMedia('(min-width:961px)').matches });
    }
    if (button.hasAttribute('data-add')) {
      if (!newStep) {
        const count = stepsOf(readDocument(host.source())).length;
        newPreviewStep = count ? selected + 1 : 0;
        newStep = newStepForm(container.querySelector<HTMLSelectElement>('#builder-new-action')!.value as Action);
        try { newStep.line = String(prefixSnapshot(host.source(), count).line || 1); } catch { /* Validation on Save will explain earlier errors. */ }
      }
      editingNew = true; optionsOpen = false; render();
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
    container.querySelector<HTMLElement>('.builder-form-status')!.textContent = 'Unsaved form edits';
  }
  function syncPicking(on = false) {
    const button = container.querySelector<HTMLButtonElement>('[data-pick-code]');
    if (!button) return;
    button.disabled = !on && !host.canPick();
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? 'Cancel picking' : 'Pick from preview';
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
  return { followPreview, applyCodeTarget, syncPicking, reset() { pending.clear(); newStep = undefined; editingNew = false; optionsOpen = false; detailsPending = undefined; selected = 0; render(); }, refresh: render, revealSelected, selectedStep: () => Math.max(0, editingNew ? newPreviewStep : selected + 1) };
}
