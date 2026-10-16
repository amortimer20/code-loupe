/**
 * Pure expression trees and step snapshots for the math loupe prototype.
 * No DOM or timing: rendering and animation consume these snapshots, as in code loupes.
 * Results are teacher-authored; this module does not calculate or check them.
 */
/** `⁢` is invisible multiplication, as in 2x. */
export type Operator = '×' | '÷' | '⁢';
export type Sign = '+' | '−';
export interface TermNode { kind: 'term'; id: string; sign: Sign; body: MathNode }
/**
 * Addition and subtraction are one flat list of signed terms, as in algebra:
 * 2x + 3 − 3 has three terms, so +3 and −3 can be combined as a pair.
 * A sum with one term displays as just that term.
 */
export type MathNode =
  | { kind: 'number'; id: string; value: number }
  | { kind: 'variable'; id: string; name: string }
  | { kind: 'binary'; id: string; op: Operator; left: MathNode; right: MathNode }
  | { kind: 'group'; id: string; body: MathNode }
  | { kind: 'sum'; id: string; terms: TermNode[] }
  | TermNode
  | { kind: 'equation'; id: string; left: MathNode; right: MathNode };

export const num = (id: string, value: number): MathNode => ({ kind: 'number', id, value });
export const variable = (id: string, name: string): MathNode => ({ kind: 'variable', id, name });
export const binary = (id: string, left: MathNode, op: Operator, right: MathNode): MathNode => ({ kind: 'binary', id, op, left, right });
export const times = (id: string, left: MathNode, right: MathNode) => binary(id, left, '⁢', right);
export const group = (id: string, body: MathNode): MathNode => ({ kind: 'group', id, body });
export const term = (id: string, sign: Sign, body: MathNode): TermNode => ({ kind: 'term', id, sign, body });
/** Terms named after their body by default: plus(num('three', 3)) has id "t-three". */
export const plus = (body: MathNode, id = `t-${body.id}`) => term(id, '+', body);
export const minus = (body: MathNode, id = `t-${body.id}`) => term(id, '−', body);
export const sum = (id: string, ...terms: TermNode[]): MathNode => ({ kind: 'sum', id, terms });
export const equation = (id: string, left: MathNode, right: MathNode): MathNode => ({ kind: 'equation', id, left, right });

export type MathChange =
  /** Replace a node, or several adjacent terms of one sum, with an authored result. */
  | { kind: 'evaluate'; target: string | string[]; result: MathNode }
  /** Add a term to the end of a sum, such as subtracting 3 from one side. */
  | { kind: 'append'; target: string; term: TermNode }
  /** Apply an operation to a whole node, such as dividing one side by 2. */
  | { kind: 'wrap'; target: string; id: string; op: Operator; operand: MathNode }
  /** Drop a term from a sum, such as + 0. */
  | { kind: 'remove'; target: string };
/** A teacher-authored value shown in the Variables panel; the player does not solve for it. */
export interface MathVariable { name: string; value: number | 'unknown' }
export interface MathLessonStep {
  caption: string;
  /** Update listed variables by name, such as x becoming 4 once it is solved. */
  variables?: MathVariable[];
  /** Node ids to emphasize. Defaults to what the changes introduce; otherwise nothing. */
  focus?: string[];
  /** Applied together, so both sides of an equation can change in one step. */
  changes?: MathChange[];
}
export interface MathLesson {
  id: string; title: string; objective: string; start: MathNode; steps: MathLessonStep[];
  /** Shown from step 1, like the rest of the explanation. */
  variables?: MathVariable[];
}
export interface MathSnapshot {
  expression: MathNode;
  focus: string[];
  variables: MathVariable[];
  caption: string;
  spoken: string;
  /** The changes that produced this snapshot from the previous one. */
  changes: MathChange[];
}

/**
 * Visible glyphs. Signs, operators and parentheses have no node of their own, so they
 * take ids derived from their parent; they keep identity while the parent survives.
 * `owners` lists the enclosing node ids, innermost last.
 */
export interface Token { id: string; kind: 'number' | 'variable' | 'operator' | 'paren'; text: string; owners: string[]; infix?: boolean }

export function formatNumber(value: number) {
  return value < 0 ? `−${Math.abs(value)}` : String(value);
}
/** A leading + is not written; a leading − is a negative sign. */
export const showsSign = (item: TermNode, first: boolean) => !first || item.sign === '−';

export function tokens(node: MathNode, owners: string[] = []): Token[] {
  const own = [...owners, node.id];
  switch (node.kind) {
    case 'number': return [{ id: node.id, kind: 'number', text: formatNumber(node.value), owners: own }];
    case 'variable': return [{ id: node.id, kind: 'variable', text: node.name, owners: own }];
    case 'binary': return [...tokens(node.left, own), { id: `${node.id}/op`, kind: 'operator', text: node.op, owners: own }, ...tokens(node.right, own)];
    case 'group': return [{ id: `${node.id}/(`, kind: 'paren', text: '(', owners: own }, ...tokens(node.body, own), { id: `${node.id}/)`, kind: 'paren', text: ')', owners: own }];
    case 'sum': return node.terms.flatMap((item, index) => termTokens(item, index === 0, own));
    case 'term': return termTokens(node, true, owners);
    case 'equation': return [...tokens(node.left, own), { id: `${node.id}/=`, kind: 'operator', text: '=', owners: own }, ...tokens(node.right, own)];
  }
}
function termTokens(item: TermNode, first: boolean, owners: string[]): Token[] {
  const own = [...owners, item.id];
  const sign: Token[] = showsSign(item, first) ? [{ id: `${item.id}/sign`, kind: 'operator', text: item.sign, owners: own, infix: !first }] : [];
  return [...sign, ...tokens(item.body, own)];
}

function children(node: MathNode): MathNode[] {
  switch (node.kind) {
    case 'binary': case 'equation': return [node.left, node.right];
    case 'group': case 'term': return [node.body];
    case 'sum': return node.terms;
    default: return [];
  }
}
export function nodeIds(node: MathNode): string[] {
  return [node.id, ...children(node).flatMap(nodeIds)];
}
export function findNode(node: MathNode, id: string): MathNode | undefined {
  if (node.id === id) return node;
  for (const child of children(node)) { const found = findNode(child, id); if (found) return found; }
  return undefined;
}
/** Rebuild the tree, letting `visit` replace any node (children are visited first). */
function rebuild(node: MathNode, visit: (node: MathNode) => MathNode): MathNode {
  const map = (child: MathNode) => rebuild(child, visit);
  switch (node.kind) {
    case 'binary': return visit({ ...node, left: map(node.left), right: map(node.right) });
    case 'equation': return visit({ ...node, left: map(node.left), right: map(node.right) });
    case 'group': return visit({ ...node, body: map(node.body) });
    case 'term': return visit({ ...node, body: map(node.body) });
    case 'sum': return visit({ ...node, terms: node.terms.map(item => map(item) as TermNode) });
    default: return visit(node);
  }
}
export function replaceNode(root: MathNode, id: string, replacement: MathNode): MathNode {
  return rebuild(root, node => node.id === id ? replacement : node);
}
function parentSum(root: MathNode, termId: string) {
  let found: Extract<MathNode, { kind: 'sum' }> | undefined;
  rebuild(root, node => { if (node.kind === 'sum' && node.terms.some(item => item.id === termId)) found = node; return node; });
  return found;
}

const words: Record<Operator, string> = { '×': ' times ', '÷': ' divided by ', '⁢': ' ' };
export function speak(node: MathNode): string {
  switch (node.kind) {
    case 'number': return node.value < 0 ? `negative ${Math.abs(node.value)}` : String(node.value);
    case 'variable': return node.name;
    case 'binary': return `${speak(node.left)}${words[node.op]}${speak(node.right)}`;
    case 'group': return `open parenthesis ${speak(node.body)} close parenthesis`;
    case 'sum': return node.terms.map((item, index) => index === 0
      ? `${item.sign === '−' ? 'negative ' : ''}${speak(item.body)}`
      : `${item.sign === '+' ? 'plus' : 'minus'} ${speak(item.body)}`).join(' ');
    case 'term': return `${node.sign === '+' ? 'plus' : 'minus'} ${speak(node.body)}`;
    case 'equation': return `${speak(node.left)} equals ${speak(node.right)}`;
  }
}

function assertUniqueIds(node: MathNode, where: string) {
  const seen = new Set<string>();
  for (const id of nodeIds(node)) {
    if (seen.has(id)) throw new Error(`${where}: node id "${id}" is used more than once.`);
    seen.add(id);
  }
}

/** Ids a change introduces; the default emphasis for its step. */
function introduced(change: MathChange): string[] {
  switch (change.kind) {
    case 'evaluate': return [change.result.id];
    case 'append': return [change.term.id];
    case 'wrap': return [change.id];
    case 'remove': return [];
  }
}

function apply(root: MathNode, change: MathChange, where: string): MathNode {
  const existing = new Set(nodeIds(root));
  const fresh = (node: MathNode, allowed: Set<string> = new Set()) => {
    const reused = nodeIds(node).find(id => existing.has(id) && !allowed.has(id));
    if (reused) throw new Error(`${where}: new node id "${reused}" is already in use.`);
  };
  const lookup = (id: string) => {
    const node = findNode(root, id);
    if (!node) throw new Error(`${where}: cannot ${change.kind} missing node "${id}".`);
    return node;
  };
  switch (change.kind) {
    case 'evaluate': {
      const targets = typeof change.target === 'string' ? [change.target] : change.target;
      const removed = new Set(targets.flatMap(id => nodeIds(lookup(id))));
      // A result may keep ids from what it replaces, as x survives 2x ÷ 2 → x.
      fresh(change.result, removed);
      if (targets.length === 1 && findNode(root, targets[0])!.kind !== 'term') return replaceNode(root, targets[0], change.result);
      if (change.result.kind !== 'term') throw new Error(`${where}: evaluating terms must produce a term.`);
      const owner = parentSum(root, targets[0]);
      const start = owner?.terms.findIndex(item => item.id === targets[0]) ?? -1;
      if (!owner || targets.some((id, offset) => owner.terms[start + offset]?.id !== id)) throw new Error(`${where}: evaluated terms must be adjacent terms of one sum.`);
      const terms = [...owner.terms]; terms.splice(start, targets.length, change.result);
      return replaceNode(root, owner.id, { ...owner, terms });
    }
    case 'append': {
      const owner = lookup(change.target);
      if (owner.kind !== 'sum') throw new Error(`${where}: can only append a term to a sum.`);
      fresh(change.term);
      return replaceNode(root, owner.id, { ...owner, terms: [...owner.terms, change.term] });
    }
    case 'wrap': {
      const target = lookup(change.target);
      if (existing.has(change.id)) throw new Error(`${where}: new node id "${change.id}" is already in use.`);
      fresh(change.operand);
      return replaceNode(root, target.id, binary(change.id, target, change.op, change.operand));
    }
    case 'remove': {
      lookup(change.target);
      const owner = parentSum(root, change.target);
      if (!owner) throw new Error(`${where}: can only remove a term of a sum.`);
      if (owner.terms.length === 1) throw new Error(`${where}: cannot remove the only term of a sum.`);
      return replaceNode(root, owner.id, { ...owner, terms: owner.terms.filter(item => item.id !== change.target) });
    }
  }
}

/** Snapshot 0 is the untouched starting expression; snapshot n follows authored step n. */
export function buildMathSnapshots(lesson: MathLesson): MathSnapshot[] {
  assertUniqueIds(lesson.start, `${lesson.id} start`);
  const snapshots: MathSnapshot[] = [{ expression: lesson.start, focus: [], variables: [], caption: '', spoken: speak(lesson.start), changes: [] }];
  lesson.steps.forEach((step, index) => {
    const where = `${lesson.id} step ${index + 1}`, changes = step.changes ?? [];
    const previous = snapshots[snapshots.length - 1];
    let expression = previous.expression;
    const variables = (index === 0 ? lesson.variables ?? [] : previous.variables).map(item => ({ ...item }));
    for (const update of step.variables ?? []) {
      const existing = variables.find(item => item.name === update.name);
      if (!existing) throw new Error(`${where}: variable "${update.name}" is not declared by the lesson.`);
      existing.value = update.value;
    }
    for (const change of changes) { expression = apply(expression, change, where); assertUniqueIds(expression, where); }
    const focus = step.focus ?? changes.flatMap(introduced);
    const missing = focus.find(id => !findNode(expression, id));
    if (missing) throw new Error(`${where}: cannot focus missing node "${missing}".`);
    snapshots.push({ expression, focus, variables, caption: step.caption, spoken: speak(expression), changes });
  });
  return snapshots;
}

/**
 * For animation: which old glyphs turn into which new ones. Each evaluation maps
 * the glyphs it replaced to the glyphs of its result; other changes need no pairing.
 */
export function evaluationPairs(previous: MathNode, next: MathNode, changes: MathChange[]) {
  const before = tokens(previous), after = tokens(next);
  return changes.flatMap(change => {
    if (change.kind !== 'evaluate') return [];
    const targets = typeof change.target === 'string' ? [change.target] : change.target;
    return [{
      sources: before.filter(token => token.owners.some(owner => targets.includes(owner))).map(token => token.id),
      results: after.filter(token => token.owners.includes(change.result.id)).map(token => token.id),
    }];
  });
}
