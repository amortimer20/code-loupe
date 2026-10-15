import type { ScalarValue } from 'code-loupe/lesson';
import { isListAddress, isName } from './addresses';
import type { Action, StepForm } from './lesson-document';

export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const scalar = (value: unknown): value is ScalarValue => value === null || ['string', 'number', 'boolean'].includes(typeof value);
export const list = (value: unknown): value is ScalarValue[] => Array.isArray(value) && value.every(scalar);
export const knownKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));

/**
 * Which form fields an action uses, beyond line and caption. Change detection compares only
 * these, so an untouched or hidden control never counts as an edit.
 */
export interface ActionFields {
  /** The code a badge or converted result sits over, and its occurrence. */
  over?: boolean;
  selection?: boolean;
  /** A variable, list, or list-element address. */
  name?: boolean;
  /** Where the value comes from, such as a literal or the latest badge. */
  source?: boolean;
  /** Plain text: output, a prompt, or entered input. */
  text?: boolean;
  /** A typed value, always or only when it is a literal. */
  typed?: 'always' | 'literal';
  /** Whether a number can choose how it is displayed. */
  numeric?: boolean;
}

/** Everything the builder's model knows about one action, in one place. */
export interface ActionDefinition {
  label: string;
  /** The YAML a new step of this action starts as. */
  start: unknown;
  /** How a new card's form differs from the common defaults. */
  newForm?: Partial<StepForm>;
  /** Whether the step's value for this action is a shape the builder can edit; otherwise YAML owns it. */
  accepts: (spec: unknown) => boolean;
  /** One line for a saved card, given the value to show. */
  summary: (form: StepForm, shown: string) => string;
  fields: ActionFields;
  /** Whether the value can be a list. */
  listValues?: boolean;
}

/** A value read from `value` or the latest badge, as `update` and `append` accept it. */
const badgeOrScalar = (spec: Record<string, unknown>) => spec.from === 'badge' ? !('value' in spec) : spec.from === undefined && scalar(spec.value);

/** Listed in the order the action menu shows them. */
export const actionDefinitions: Record<Action, ActionDefinition> = {
  highlight: {
    label: 'Highlight a line', start: { line: 1 }, fields: {},
    accepts: () => true,
    summary: form => form.line ? `Highlight line ${form.line}` : 'Explain the current moment',
  },
  badge: {
    label: 'Show a value', start: { badge: { over: '', value: 0 } },
    fields: { over: true, selection: true, source: true, typed: 'literal', numeric: true }, listValues: true,
    accepts: spec => record(spec) && knownKeys(spec, ['over', 'value', 'type', 'nth', 'from']) && (scalar(spec.value) || list(spec.value))
      && (spec.from === undefined || (typeof spec.from === 'string' && (isName(spec.from) || isListAddress(spec.from))))
      && !(spec.from === 'console' && typeof spec.value !== 'string'),
    summary: (form, shown) => form.source === 'literal' ? `Show ${shown}` : `Read ${form.source}`,
  },
  assign: {
    label: 'Store a value', start: { assign: { var: '', value: 0 } },
    fields: { name: true, source: true, typed: 'literal', numeric: true }, listValues: true,
    accepts: spec => record(spec) && knownKeys(spec, ['var', 'value', 'type', 'from'])
      && (spec.from === 'badge' || scalar(spec.value) || list(spec.value))
      && !((spec.from !== undefined && spec.from !== 'badge') || (spec.from === 'badge' && ('value' in spec || 'type' in spec))),
    summary: (form, shown) => `Store ${shown} in ${form.name || 'a variable'}`,
  },
  print: {
    label: 'Print', start: { print: '' }, newForm: { value: '' }, fields: { source: true, text: true },
    accepts: spec => typeof spec === 'string' || (record(spec) && knownKeys(spec, ['text', 'from']) && typeof spec.text === 'string' && (spec.from === undefined || spec.from === 'badge')),
    summary: form => form.source === 'badge' ? 'Print the latest badge' : `Print ${JSON.stringify(form.value)}`,
  },
  write: {
    label: 'Show a prompt', start: { write: '' }, newForm: { value: '' }, fields: { source: true, text: true },
    accepts: spec => typeof spec === 'string' || (record(spec) && knownKeys(spec, ['text', 'from']) && typeof spec.text === 'string' && (spec.from === undefined || spec.from === 'badge')),
    summary: form => `Prompt ${JSON.stringify(form.value)}`,
  },
  input: {
    label: 'Show entered text', start: { input: '' }, newForm: { kind: 'Text', value: '' }, fields: { text: true },
    accepts: spec => typeof spec === 'string',
    summary: form => `Enter ${JSON.stringify(form.value)}`,
  },
  convert: {
    label: 'Convert a value', start: { convert: { value: 0 } }, newForm: { source: 'badge' },
    fields: { over: true, typed: 'always', numeric: true },
    accepts: spec => record(spec) && knownKeys(spec, ['over', 'value', 'type', 'nth']) && scalar(spec.value)
      && (spec.over === undefined ? spec.nth === undefined : typeof spec.over === 'string' && spec.over.length > 0),
    summary: (_form, shown) => `Convert to ${shown}`,
  },
  update: {
    label: 'Update a list element', start: { update: { target: 'numbers[0]', value: 0 } },
    fields: { name: true, source: true, typed: 'literal' },
    accepts: spec => record(spec) && knownKeys(spec, ['target', 'value', 'from']) && isListAddress(spec.target) && badgeOrScalar(spec),
    summary: (form, shown) => `Set ${form.name || 'a list element'} to ${shown}`,
  },
  select: {
    label: 'Select a list element', start: { select: null }, fields: { name: true },
    accepts: spec => spec === null || isListAddress(spec),
    summary: form => form.name ? `Select ${form.name}` : 'Clear list selection',
  },
  append: {
    label: 'Append an item', start: { append: { target: 'numbers', value: 0 } },
    fields: { name: true, source: true, typed: 'literal' },
    accepts: spec => record(spec) && knownKeys(spec, ['target', 'value', 'from']) && isName(spec.target) && badgeOrScalar(spec),
    summary: (form, shown) => `Append ${shown} to ${form.name || 'a list'}`,
  },
  remove: {
    label: 'Remove a list element', start: { remove: 'numbers[0]' }, fields: { name: true },
    accepts: spec => isListAddress(spec),
    summary: form => `Remove ${form.name || 'a list element'}`,
  },
};

/** Steps that carry their action under a key of the same name; `highlight` is only a line. */
export const isStepAction = (key: string): key is Exclude<Action, 'highlight'> => key !== 'highlight' && Object.hasOwn(actionDefinitions, key);
