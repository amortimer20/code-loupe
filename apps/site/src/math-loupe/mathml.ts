import { formatNumber, showsSign, type MathNode, type TermNode } from './expression';

const NS = 'http://www.w3.org/1998/Math/MathML';

function element(tag: string, attributes: Record<string, string>, text?: string) {
  const node = document.createElementNS(NS, tag) as MathMLElement;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Render a tree as MathML. Every glyph carries `data-token` (matching `tokens()`),
 * and every node's outer element carries `data-node`, so animation can measure both.
 * The browser's operator dictionary supplies operator spacing.
 */
function render(node: MathNode, focus: ReadonlySet<string>, inFocus: boolean): MathMLElement {
  const focused = inFocus || focus.has(node.id);
  const mark = (el: MathMLElement) => { if (focused) el.classList.add('ml-focus-glyph'); return el; };
  const row = (...content: MathMLElement[]) => { const el = element('mrow', { 'data-node': node.id }); el.append(...content); return el; };
  const operator = (id: string, text: string) => mark(element('mo', { 'data-token': id }, text));
  switch (node.kind) {
    case 'number': return mark(element('mn', { 'data-node': node.id, 'data-token': node.id }, formatNumber(node.value)));
    case 'variable': return mark(element('mi', { 'data-node': node.id, 'data-token': node.id }, node.name));
    case 'binary': return row(render(node.left, focus, focused), operator(`${node.id}/op`, node.op), render(node.right, focus, focused));
    case 'group': return row(operator(`${node.id}/(`, '('), render(node.body, focus, focused), operator(`${node.id}/)`, ')'));
    case 'sum': return row(...node.terms.map((item, index) => term(item, index === 0, focus, focused)));
    case 'term': return term(node, true, focus, focused);
    case 'equation': return row(render(node.left, focus, focused), operator(`${node.id}/=`, '='), render(node.right, focus, focused));
  }
}
/**
 * Each term is its own row so it can be emphasized with its sign. A sign that
 * starts a row would otherwise get prefix spacing, so later signs are marked infix.
 */
function term(item: TermNode, first: boolean, focus: ReadonlySet<string>, inFocus: boolean) {
  const focused = inFocus || focus.has(item.id);
  const row = element('mrow', { 'data-node': item.id });
  if (showsSign(item, first)) {
    const sign = element('mo', { 'data-token': `${item.id}/sign`, form: first ? 'prefix' : 'infix' }, item.sign);
    if (focused) sign.classList.add('ml-focus-glyph');
    row.append(sign);
  }
  row.append(render(item.body, focus, focused));
  return row;
}

export function renderMath(expression: MathNode, focus: readonly string[] = []): MathMLElement {
  const math = element('math', { display: 'inline' });
  math.append(render(expression, new Set(focus), false));
  return math;
}
