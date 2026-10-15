import type { Snapshot } from 'code-loupe/state';
import { findNth } from 'code-loupe/state';
import { formatValue } from '../../../../packages/player/src/values';
import { actionDefinitions } from './actions';
import { badgeDisplay, stepSummary, storedDisplay } from './builder-presentation';
import { html, raw, type SafeHtml } from './html';
import { actionLabels, badgeSources, formOf, latestConsoleInput, listBindings, type Action, type StepForm } from './lesson-document';
import { languageChoices, type LanguageChoice } from './languages';

/** A form the teacher has edited but not saved, kept beside the YAML step it was read from. */
export interface Pending { base: string; values: StepForm | { caption: string } }
const option = (value: string, label: string, selected: string) => html`<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`;
const actionGroups: { label: string; actions: Action[] }[] = [
  { label: 'Explanation', actions: ['highlight'] },
  { label: 'Values and variables', actions: ['badge', 'assign', 'convert'] },
  { label: 'Console', actions: ['write', 'input', 'print'] },
  { label: 'Lists', actions: ['select', 'update', 'append', 'remove'] },
];
const field = (name: string, label: string, value: string, type = 'text', placeholder = '') => html`<label>${label}<input name="${name}" type="${type}" aria-label="${label}" ${type === 'number' ? raw('step="any"') : ''} value="${value}"${placeholder ? html` placeholder="${placeholder}"` : ''}></label>`;
const captionField = (value: string) => html`<label>Caption<textarea aria-label="Caption" name="caption" rows="3">${value}</textarea></label>`;
const errorBox = raw('<p class="builder-field-error" role="alert" hidden></p>');
function stepActions(isNew: boolean, dirty: boolean, base: string) {
  const secondary = isNew
    ? raw('<button type="button" data-cancel-new>Cancel new step</button>')
    : html`<button type="button" data-reload-step ${dirty ? '' : 'hidden'}>Discard edits</button>`;
  const deletion = isNew ? '' : html`<button type="button" class="builder-delete" data-delete-step data-base="${base}" title="Undo restores a deleted step. Later steps may need repair.">Delete step</button>`;
  return html`<div class="builder-action-row"><div class="builder-save-actions"><button class="builder-primary" type="submit">Save step</button>${secondary}</div>${deletion}</div><span class="builder-form-status" role="status"></span>`;
}

export function valueFields(form: StepForm): SafeHtml {
  const kind = html`<label>Value type<select aria-label="Value type" name="kind">${(actionDefinitions[form.action].listValues ? ['Number', 'Text', 'Boolean', 'None', 'List'] : ['Number', 'Text', 'Boolean', 'None']).map(value => option(value, value, form.kind))}</select></label>`;
  if (form.kind === 'List') return html`${kind}<div class="builder-list-items">${(form.items ?? []).map((item, index) => html`<div class="builder-fields"><label>Item ${index} type<select name="item-kind-${index}" aria-label="Item ${index} type">${['Number', 'Text', 'Boolean', 'None'].map(type => option(type, type, item.kind))}</select></label>${item.kind === 'None' ? raw('<span>None</span>') : item.kind === 'Boolean' ? html`<label>Item ${index} value<select name="item-value-${index}" aria-label="Item ${index} value">${option('true', 'True', item.value)}${option('false', 'False', item.value)}</select></label>` : field(`item-value-${index}`, `Item ${index} value`, item.value)}<button type="button" data-remove-item="${index}">Remove item ${index}</button></div>`)}<button type="button" data-add-item>Add list item</button><p class="builder-note">Items are numbered from 0. Empty lists are allowed; nested lists are not supported.</p></div>`;
  const value = form.kind === 'None'  ? raw('<label>Value<input value="None" disabled></label>')
    : form.kind === 'Boolean' ? html`<label>Value<select aria-label="Value" name="value">${option('true', 'True', form.value)}${option('false', 'False', form.value)}</select></label>`
    : field('value', 'Value', form.value); // Text input preserves incomplete numeric entries.
  return html`<div class="builder-fields">${kind}${value}</div>`;
}

export function occurrenceNeeded(form: StepForm, code: string, currentLine: number) {
  const line = code.split('\n')[Number(form.line || currentLine) - 1] ?? '';
  return form.nth !== '1' || (!!form.over && findNth(line, form.over, 2) >= 0);
}

/** What `stepFields` needs besides the form: the preview state before this step and what the host allows. */
export interface FieldsModel {
  form: StepForm; code: string;
  context: Snapshot | undefined; contextError: string; language: string;
  optionsOpen: boolean; canPick: boolean;
}

export function stepFields(model: FieldsModel): SafeHtml {
  const { form, code, context, contextError, language, optionsOpen, canPick } = model;
  const display = (value: Parameters<typeof formatValue>[0], type?: string) => formatValue(value, language, type);
  const lines = code.replace(/\n+$/, '').split('\n');
  const choices = lines.map((text, index) => option(String(index + 1), `${index + 1} · ${text.trim()}`, form.line));
  if (form.line && !choices.some((_choice, index) => String(index + 1) === form.line)) choices.push(option(form.line, `${form.line} · check this line`, form.line));
  const parts: SafeHtml[] = [html`<div class="builder-fields"><label>Step action<select aria-label="Step action" name="action">${Object.entries(actionLabels).map(([key, label]) => option(key, label, form.action))}</select></label><div class="builder-line-field"><label for="builder-code-line">Code line</label><div class="builder-code-target" role="group" aria-label="Line targeting"><select id="builder-code-line" aria-label="Code line" name="line">${option('', 'Keep current line', form.line)}${choices}</select><button type="button" class="builder-pick" data-pick-code aria-label="Pick from preview" title="Pick from preview" aria-pressed="false" ${canPick ? '' : 'disabled'}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg></button></div></div></div>`];
  parts.push(raw(`<p class="builder-note" data-code-pick-status role="status"></p>`));
  if (form.action === 'badge') {
    const vars = context ? badgeSources(context) : [];
    const source = vars.find(variable => variable.name === form.source);
    if (form.source !== 'literal' && form.source !== 'console' && !vars.some(variable => variable.name === form.source)) parts.push(raw('<p class="builder-note">This source needs a valid earlier step. Its current value cannot be filled yet.</p>'));
    parts.push(html`<div class="builder-fields">${field('over', 'Code to highlight', form.over, 'text', 'count + 1')}<div data-occurrence ${occurrenceNeeded(form, code, context?.line ?? 0) ? '' : 'hidden'}>${field('nth', 'Occurrence', form.nth)}</div><label>Value source<select aria-label="Value source" name="source">${option('literal', 'Enter a value', form.source)}${option('console', 'Latest console input', form.source)}${vars.map(variable => option(variable.name, `Variable: ${variable.name} = ${display(variable.value, variable.type)}`, form.source))}${form.source !== 'literal' && form.source !== 'console' && !vars.some(variable => variable.name === form.source) ? option(form.source, `Variable: ${form.source}`, form.source) : ''}</select></label></div>`);
    parts.push(form.source === 'literal' ? valueFields(form) : form.source === 'console'
      ? html`<p class="builder-note">${context && latestConsoleInput(context) !== undefined ? html`Latest entered text: ${JSON.stringify(latestConsoleInput(context))}` : 'No earlier entered text is available.'} Saving fills a text value from that authored input.</p>`
      : html`<p class="builder-note">${source ? `Current value: ${display(source.value, source.type)}. ` : ''}Save fills this read from earlier authored steps.</p>`);
  }
  if (form.action === 'badge') {
    const elements = context ? badgeSources(context).filter(item => item.name.endsWith(']')) : [];
    if (elements.length || form.selection || context?.selection) parts.push(html`<label>List selection<select aria-label="List selection" name="selection">${option('', 'Keep current selection', form.selection ?? '')}${option('clear', 'Clear selection', form.selection ?? '')}${elements.map(item => option(item.name, `${item.name} = ${display(item.value)}`, form.selection ?? ''))}${form.selection && form.selection !== 'clear' && !elements.some(item => item.name === form.selection) ? option(form.selection, `${form.selection} · unavailable`, form.selection) : ''}</select></label>`);
  }
  if (['select', 'update', 'remove'].includes(form.action)) {
    const elements = context ? badgeSources(context).filter(item => item.name.endsWith(']')) : [];
    parts.push(html`<label>List element<select aria-label="List element" name="name">${option('', form.action === 'select' ? 'Clear selection' : 'Choose an element', form.name)}${elements.map(item => option(item.name, `${item.name} = ${display(item.value)}`, form.name))}${form.name && !elements.some(item => item.name === form.name) ? option(form.name, `${form.name} · unavailable`, form.name) : ''}</select></label>`);
  }
  if (form.action === 'append') {
    const lists = context ? listBindings(context) : [];
    parts.push(html`<label>List<select aria-label="List" name="name">${option('', 'Choose a list', form.name)}${lists.map(variable => option(variable.name, `${variable.name} = ${storedDisplay(context!, variable.value, language, variable.type)}`, form.name))}${form.name && !lists.some(variable => variable.name === form.name) ? option(form.name, `${form.name} · unavailable`, form.name) : ''}</select></label><p class="builder-note">Adds one item at the end, including when the list is empty.</p>`);
  }
  if (form.action === 'remove') parts.push(raw('<p class="builder-note">Deletes by index, as Python del does. Later items shift down one index; no result badge is created.</p>'));
  if (['assign', 'update', 'append'].includes(form.action)) {
    parts.push(html`<div class="builder-fields">${form.action === 'assign' ? field('name', 'Variable name', form.name) : ''}<label>Value source<select aria-label="Value source" name="source">${option('literal', 'Enter a value', form.source)}${option('badge', 'Latest badge', form.source)}</select></label></div>`);
    if (form.source === 'literal') parts.push(valueFields(form));
  }
  if (['print', 'write'].includes(form.action)) {
    parts.push(html`<label>Output source<select aria-label="Output source" name="source">${option('literal', 'Enter output text', form.source)}${option('badge', 'Latest badge', form.source)}</select></label>`);
    if (form.action === 'write') parts.push(raw('<p class="builder-note">Writes without a newline, so entered text can follow the prompt on the same line. Include any trailing space you want.</p>'));
    parts.push(html`<label>Output text<textarea aria-label="Output text" name="value" rows="2">${form.value}</textarea></label>`);
  }
  if (form.action === 'input') parts.push(html`<label>Entered text<textarea aria-label="Entered text" name="value" rows="2">${form.value}</textarea></label><p class="builder-note">Text the teacher chooses for this explanation, including digits or empty input. Students are stepping through an authored response.</p>`);
  if (form.action === 'convert') {
    parts.push(html`<div class="builder-fields">${field('over', 'Result expression (optional)', form.over)}<div data-occurrence ${form.over && occurrenceNeeded(form, code, context?.line ?? 0) ? '' : 'hidden'}>${field('nth', 'Occurrence', form.nth)}</div></div><p class="builder-note">Leave the expression blank to keep the badge in place. Enter the converted result below; no conversion code is executed.</p>${valueFields(form)}`);
  }
  if (form.source === 'badge') {
    const changedLine = form.line && Number(form.line) !== context?.line;
    const badge = changedLine ? undefined : context?.badges.at(-1);
    const hint = form.action === 'assign' ? 'Stores this value in the variable.'
      : form.action === 'update' ? 'Replaces the selected list element.'
      : form.action === 'append' ? 'Adds this value at the end of the list.'
      : ['print', 'write'].includes(form.action) ? 'Output text must contain this badge’s printed value.' : '';
    parts.push(html`<p class="builder-note">Latest badge: ${badge && context ? badgeDisplay(context, badge, language) : 'none on this line'}. ${hint}</p>`);
  }
  if (contextError) parts.push(html`<p class="builder-note">Earlier state needs repair: ${contextError}</p>`);
  if (['badge', 'assign', 'convert'].includes(form.action) && (form.source === 'literal' || form.action === 'convert') && form.kind === 'Number') {
    parts.push(html`<details class="builder-options" ${optionsOpen || form.numericType !== 'auto' ? 'open' : ''}><summary>Optional settings</summary><label>Number display<select aria-label="Number display" name="numericType">${option('auto', 'Automatic', form.numericType)}${option('int', 'Integer', form.numericType)}${option('float', 'Float (e.g. 5.0)', form.numericType)}</select></label></details>`);
  }
  return html`${parts}${captionField(form.caption)}${errorBox}`;
}

/** Everything the builder draws, as already-reconciled state. Drawing never changes it. */
export interface BuilderModel {
  steps: Record<string, unknown>[];
  details: { title: string; language: string; code: string };
  /** The details form as shown: the unsaved edits when there are any. */
  shownDetails: { title: string; language: string; code: string };
  detailsPending: boolean; staleDetails: boolean; detailsOpen: boolean;
  languages: readonly LanguageChoice[];
  newStep: StepForm | undefined; newPosition: number; editingNew: boolean;
  selected: number; expanded: boolean; organizeOpen: boolean;
  pending: ReadonlyMap<number, Pending>;
  /** The action-specific fields of the one expanded form. */
  fields: (form: StepForm) => SafeHtml;
}

export function renderUnreadable(message: string): SafeHtml {
  return html`<p role="alert">${message}</p><button type="button" data-yaml>Open YAML</button>`;
}

export function renderBuilder(model: BuilderModel): SafeHtml {
  const { steps, details, newStep, newPosition, editingNew, selected, expanded, organizeOpen, pending, detailsOpen, detailsPending, staleDetails, languages, fields } = model;
  const shown = model.shownDetails;
  const cards = [...steps];
  if (newStep) cards.splice(newPosition, 0, {});
  return html`<details class="builder-details" ${detailsOpen ? 'open' : ''}><summary>Lesson details · ${details.language}</summary><form data-details><label>Title<input name="title" value="${shown.title}"></label><label>Language<select name="language" aria-label="Language">${languageChoices(languages, shown.language).map(choice => option(choice.id, choice.name, shown.language))}</select></label><p class="builder-note">Language controls syntax highlighting and value formatting. You still author the steps.</p><label>Displayed code<textarea aria-label="Displayed code" name="code" rows="5" spellcheck="false" class="builder-code">${shown.code}</textarea></label>${errorBox}<div class="builder-apply"><button type="submit">Save lesson details</button><button type="button" data-reload-details ${detailsPending ? '' : 'hidden'}>Discard details edits</button><span class="builder-form-status" role="status">${staleDetails ? 'YAML changed; discard details edits before saving.' : detailsPending ? 'Unsaved form edits' : ''}</span></div></form></details>
      <div class="builder-heading"><h3>Teaching steps</h3><span>${steps.length} saved steps${newStep ? " · 1 new" : ""}</span></div>
      <div class="builder-cards">${cards.map((step, position) => {
        const isNew = !!newStep && position === newPosition;
        const index = newStep && position > newPosition ? position - 1 : position;
        const base = JSON.stringify(step), cache = isNew ? undefined : pending.get(index), form = isNew ? newStep : cache?.values ?? formOf(step), supported = form && 'action' in form;
        const current = isNew ? editingNew : !editingNew && index === selected;
        return html`<article class="builder-card" data-selected="${current}"><button type="button" class="builder-step" ${isNew ? raw('data-new-card') : html`data-step="${index}"`} aria-current="${current ? 'step' : 'false'}" aria-expanded="${current && expanded}" aria-controls="builder-step-panel-${position}"><span class="builder-number">${isNew ? '+' : index + 1}</span><span>${isNew ? `New · ${actionLabels[newStep!.action]}` : stepSummary(step, details.language)}</span><small>${step.line === undefined ? '' : html`Line ${step.line}`}${isNew ? 'Not saved' : html`<span data-pending-marker ${cache ? '' : 'hidden'}> · Unsaved</span>`}</small><small data-problem-marker hidden>Needs attention</small><svg class="builder-chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button><div id="builder-step-panel-${position}" ${current && expanded ? '' : 'hidden'}>${current && expanded ? html`<form data-step-form ${isNew ? 'data-new-step' : ''} data-base="${cache?.base ?? base}">${supported ? fields(form as StepForm) : html`<p class="builder-note">This action is preserved. Edit its caption here, or open YAML for other fields.</p><button type="button" data-yaml>Open this step in YAML</button>${captionField(cache?.values.caption ?? String(step.caption ?? ''))}${errorBox}`}${stepActions(isNew, !!cache, base)}${isNew ? raw('<p class="builder-note">This card is not in your YAML yet. Save inserts it here; Cancel drops it.</p>') : html`<details class="builder-organize" ${organizeOpen ? 'open' : ''}><summary>Organize step</summary><div class="builder-step-actions"><button type="button" data-move-step="-1" data-base="${base}" ${newStep || index === 0 ? 'disabled' : ''}>Move up</button><button type="button" data-move-step="1" data-base="${base}" ${newStep || index === steps.length - 1 ? 'disabled' : ''}>Move down</button><button type="button" data-insert-step ${newStep ? 'disabled' : ''}>Insert after this step</button><button type="button" data-duplicate-step data-base="${base}" ${newStep || cache ? 'disabled' : ''}>Duplicate step</button></div><p class="builder-note">Duplicate copies the saved step. Save or discard its edits first. Later steps may need repair.</p></details>`}</form>` : ''}</div></article>`;
      })}</div>
      <div class="builder-add" ${editingNew ? 'hidden' : ''}><label ${newStep ? 'hidden' : ''}>New step<select aria-label="New step" id="builder-new-action" ${newStep ? 'disabled' : ''}>${actionGroups.map(group => html`<optgroup label="${group.label}">${group.actions.map(action => option(action, actionLabels[action], 'highlight'))}</optgroup>`)}</select></label><button class="builder-primary" type="button" data-add>${newStep ? 'Edit new step' : 'Add step'}</button></div>
      <p class="builder-note">Save puts form edits into your browser draft and updates the preview. Discard drops unsaved form edits; Undo reverses saved edits. Teachers choose the outcomes; the displayed code does not run.</p>`;
}
