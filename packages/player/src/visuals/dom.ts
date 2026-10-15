/** Small DOM helpers shared by the component and its visual modules. */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Screen rectangle of `text` inside a container's own text, or null if it isn't there. */
export function textRect(container: HTMLElement, text: string): DOMRect | null {
  if (!text) return null;
  const node = [...container.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.includes(text));
  if (!node) return null;
  const start = node.textContent!.indexOf(text);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);
  return range.getBoundingClientRect();
}
