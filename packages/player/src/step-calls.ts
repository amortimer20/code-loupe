import { isReference, cloneValue } from './values';
import { checkKeys, findNth, isRecord } from './validation';
import { readBinding, readValue } from './step-bindings';
import type { BadgeState } from './state';
import type { CallFrame } from './visuals/call-stack-state';
import { constructedInstance } from './visuals/instance-state';
import type { StepContext } from './step-context';

/** Enter a function: bind parameters into a new frame and suspend the caller's badges. */
export function applyCall(ctx: StepContext) {
  const { step, s, previous, fail, checkLine, checkTarget, build } = ctx;
  if (step.call === undefined) return;
  const call = step.call;
  if (!isRecord(call)) fail('`call` needs a mapping with name, line, and over.');
  checkKeys(call, ['name', 'line', 'over', 'nth', 'args', 'construct'], 'call', fail);
  if (typeof call.name !== 'string' || !call.name.length) fail('`call` needs a nonempty function `name`.');
  checkLine(call.line);
  const callerLine = s.line ?? fail('`call` needs an active caller line.');
  const nth = call.nth ?? 1;
  checkTarget(callerLine, call.over, nth);
  if (call.args !== undefined && !Array.isArray(call.args)) fail('`call.args` must be a list.');
  const names = new Set<string>();
  const args = (call.args ?? []).map(arg => {
    if (!isRecord(arg)) fail('each call argument must be a mapping.');
    checkKeys(arg, ['var', 'value', 'type', 'from', 'ref'], 'call argument', fail);
    if (typeof arg.var !== 'string' || !arg.var.length) fail('each call argument needs a nonempty `var` parameter name.');
    if (names.has(arg.var)) fail(`duplicate parameter \`${arg.var}\`.`);
    names.add(arg.var);
    return { name: arg.var, ...readBinding(ctx, arg, 'call argument') };
  });
  if ('construct' in call) {
    const instance = constructedInstance(s, call.construct, fail);
    const self = args.find(arg => arg.name === 'self');
    if (!self || !isReference(self.value) || self.value.ref !== instance.id) fail('constructor args must bind `self` to the constructed instance.');
  }
  const frame: CallFrame = {
    id: build.nextFrameId++, name: call.name,
    vars: args.map(({ name, value, type }) => ({ name, value, type })),
    returnTo: { line: callerLine, over: call.over, nth },
    callerBadges: s.badges.map(b => ({ ...b, value: cloneValue(b.value) })),
    ...('construct' in call ? { construct: call.construct } : {}),
  };
  s.frames.push(frame);
  s.badges = [];
  s.line = call.line;
  s.events.lineChanged = s.line !== previous.line;
  s.events.called = { frameId: frame.id, args: args.map(({ name, fromBadge }) => ({ name, fromBadge })) };
}

/** Leave the active function and show its result over the saved caller target. */
export function applyReturn(ctx: StepContext) {
  const { step, s, previous, fail, build } = ctx;
  if (step.return === undefined) return;
  if (!isRecord(step.return)) fail('`return` needs a mapping with value or from.');
  checkKeys(step.return, ['value', 'type', 'from'], 'return', fail);
  const frame = s.frames.at(-1) ?? fail('`return` needs an active function call.');
  const result = readValue(ctx, step.return, 'return', true);
  if (frame.construct !== undefined && result.value !== null) fail('an initializer must finish with null (Python None), not return the instance.');
  const instance = frame.construct === undefined ? undefined : constructedInstance(s, frame.construct, fail);
  s.frames.pop();
  if (s.selection?.frameId === frame.id) s.selection = null;
  const badge: BadgeState = { id: build.nextBadgeId++, ...frame.returnTo, value: instance ? { ref: instance.id } : result.value, type: instance?.type ?? result.type };
  const callerCode = build.codeLines[frame.returnTo.line - 1];
  const callStart = findNth(callerCode, frame.returnTo.over, frame.returnTo.nth);
  const callEnd = callStart + frame.returnTo.over.length;
  const surroundingBadges = frame.callerBadges.filter(b => {
    if (b.line !== frame.returnTo.line) return true;
    const start = findNth(callerCode, b.over, b.nth);
    return start < callStart || start + b.over.length > callEnd;
  });
  // The call's result replaces its argument/expression badges, while values
  // elsewhere in the caller's expression survive. Older snapshots stay intact.
  s.badges = [...surroundingBadges, badge];
  s.line = frame.returnTo.line;
  s.events.lineChanged = s.line !== previous.line;
  s.events.returned = { frameId: frame.id, badgeId: badge.id, fromBadge: instance ? undefined : result.fromBadge };
}
