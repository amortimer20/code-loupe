import type { Snapshot } from '../state';
import { formatValue, isReference } from '../values';
import { badgeDisplayValue, resolveVariableValue } from './heap-state';

/** Keep local names unambiguous when recursion or shadowing repeats a binding. */
export function bindingLabel(snapshot: Snapshot, name: string, frameId: number): string {
  if (frameId === 0) return name;
  const frame = snapshot.frames.find(frame => frame.id === frameId);
  return frame ? `${frame.name} #${frame.id}.${name}` : name;
}

function bindingVariable(snapshot: Snapshot, name: string, frameId: number) {
  const scope = frameId === 0 ? snapshot.vars : snapshot.frames.find(frame => frame.id === frameId)?.vars;
  return scope?.find(variable => variable.name === name);
}

/** Prefer a current highlighted/action binding, then active locals, globals, and paused locals. */
export function listAccessibleName(snapshot: Snapshot, ref: string): string {
  const source = snapshot.events.badgeAdded?.from;
  const targets = [snapshot.selection, snapshot.events.updated, snapshot.events.appended,
    snapshot.events.removed, source?.kind === 'var' ? source : undefined];
  for (const target of targets) {
    if (target?.ref !== ref) continue;
    const variable = bindingVariable(snapshot, target.name, target.frameId);
    // Events can describe a read before an assignment rebinds that name in the same step.
    if (variable && isReference(variable.value) && variable.value.ref === ref) {
      return bindingLabel(snapshot, target.name, target.frameId);
    }
  }
  const active = snapshot.frames.at(-1);
  const scopes = [
    ...(active ? [{ vars: active.vars, frameId: active.id }] : []),
    { vars: snapshot.vars, frameId: 0 },
    ...snapshot.frames.slice(0, -1).reverse().map(frame => ({ vars: frame.vars, frameId: frame.id })),
  ];
  for (const scope of scopes) {
    const variable = scope.vars.find(variable => isReference(variable.value) && variable.value.ref === ref);
    if (variable) return bindingLabel(snapshot, variable.name, scope.frameId);
  }
  return ref; // Orphaned objects remain inspectable without inventing a binding.
}

/** Describe the displayed snapshot, including badges hidden from the accessibility tree. */
export function stepAnnouncement(snapshot: Snapshot, step: number, total: number, language: string): string {
  const parts = [`Step ${step} of ${total}.`];
  if (step === 0) return parts.join(' ') + ' Ready to start.';
  if (snapshot.line !== null) parts.push(`Line ${snapshot.line}.`);
  const frame = snapshot.frames.at(-1);
  if (frame) parts.push(`In ${frame.name}, frame ${frame.id}.`);
  if (snapshot.error) {
    parts.push(`${snapshot.error.name}: ${snapshot.error.message}`,
      snapshot.error.kind === 'syntax' ? 'Program did not start.' : 'Execution stopped.');
  } else {
    const events = snapshot.events;
    const badgeId = events.returned?.badgeId ?? events.converted?.id ?? events.badgeAdded?.id;
    const badge = snapshot.badges.find(badge => badge.id === badgeId);
    if (badge) {
      const value = formatValue(badgeDisplayValue(snapshot, badge.value), language, badge.type);
      parts.push(`${events.returned ? 'Return value' : 'Value of ' + badge.over}: ${value}, ${badge.type}.`);
    }
    const described = new Set<string>();
    for (const target of [events.assigned, events.updated, events.appended, events.removed]) {
      if (!target) continue;
      // Lists are described as a whole; fields retain their distinct addresses.
      const location = JSON.stringify([target.frameId, target.name,
        'attribute' in target ? ['attribute', target.attribute] : 'key' in target ? ['key', target.key] : null]);
      if (described.has(location)) continue;
      described.add(location);
      const variable = bindingVariable(snapshot, target.name, target.frameId);
      if (variable) {
        const name = bindingLabel(snapshot, target.name, target.frameId);
        const value = resolveVariableValue(snapshot, variable);
        if (Array.isArray(value)) parts.push(`${name} is ${formatValue(value, language)}.`);
        else if ('attribute' in target || 'key' in target) {
          const key = 'attribute' in target ? target.attribute : target.key;
          if (key !== undefined && typeof value === 'object' && value !== null) {
            const address = 'attribute' in target ? `${name}.${key}` : `${name}[${JSON.stringify(key)}]`;
            parts.push(`${address} is ${formatValue(value[key], language)}.`);
          }
        } else {
          parts.push(isReference(variable.value) ? `${name} points to ${variable.value.ref}.`
            : `${name} is ${formatValue(variable.value, language, variable.type)}.`);
        }
      }
    }
    for (const chunk of snapshot.console.slice(events.consoleFrom)) {
      parts.push(`${chunk.kind === 'in' ? 'Input' : 'Output'}: ${chunk.text.trim() || 'blank line'}.`);
    }
  }
  if (snapshot.caption) parts.push(snapshot.caption);
  return parts.join(' ');
}
