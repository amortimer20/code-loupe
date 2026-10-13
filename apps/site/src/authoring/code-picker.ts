import { expressionTarget, type CodeTarget } from './code-target';

interface Host { code(): string; choose(target: CodeTarget): void; message(text: string): void; active(on: boolean): void }

/** Site-only adapter for the preview's highlighted code. It never edits player state. */
export function createCodePicker(player: HTMLElement, host: Host) {
  const root = player.shadowRoot!;
  let active = false, expressions = false;
  const style = document.createElement('style');
  style.textContent = ':host([data-code-picking]) .code-host .line { cursor:crosshair; user-select:text; } :host([data-code-picking]) .code-host .line:hover { background:color-mix(in srgb, var(--ca-accent) 24%, var(--ca-bg)); box-shadow:inset 3px 0 var(--ca-accent); transition:none; }';
  root.append(style);

  function cancel() {
    if (!active) return;
    active = false; player.removeAttribute('data-code-picking'); host.active(false);
  }
  function lineOf(node: Node) {
    return (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('.code-host .line');
  }
  function offset(line: HTMLElement, node: Node, position: number) {
    const range = document.createRange();
    range.selectNodeContents(line); range.setEnd(node, position);
    return range.toString().length;
  }
  root.addEventListener('mouseup', event => {
    if (!active || (event as MouseEvent).button !== 0) return;
    const clicked = (event.target as Element).closest<HTMLElement>('.code-host .line');
    if (!clicked) return;
    try {
      const selection = document.getSelection();
      // Composed ranges retain text-node offsets inside the open shadow root.
      // Older engines can supply the same range via their shadow-root selection.
      const local = (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ?? selection;
      const range = selection?.getComposedRanges?.({ shadowRoots:[root] })[0]
        ?? (local?.rangeCount ? local.getRangeAt(0) : undefined);
      const lines = [...root.querySelectorAll<HTMLElement>('.code-host .line')];
      let line = clicked, target: CodeTarget;
      if (range && !range.collapsed) {
        const first = lineOf(range.startContainer), last = lineOf(range.endContainer);
        if (!first || first !== last) throw new Error('Select an expression within one code line.');
        if (!expressions) throw new Error('This step uses a line. Click a line, or choose Show a value to pick an expression.');
        line = first;
        const number = lines.indexOf(line) + 1, code = host.code();
        if (line.textContent !== code.replace(/\n+$/, '').split('\n')[number - 1]) throw new Error('The preview changed. Pick the target again after it finishes loading.');
        target = expressionTarget(code, number, offset(line, range.startContainer, range.startOffset), offset(line, range.endContainer, range.endOffset));
      } else target = { line:lines.indexOf(line) + 1 };
      cancel();
      host.choose(target);
      selection?.removeAllRanges();
      host.message(target.over === undefined ? `Line ${target.line} selected. Save the step to apply it.` : `Line ${target.line}, occurrence ${target.nth} selected. Review the value, then save the step.`);
    } catch (error) { host.message((error as Error).message); }
  });
  document.addEventListener('keydown', event => {
    if (active && event.key === 'Escape') {
      event.preventDefault(); cancel(); host.message('Picking cancelled. Your form is unchanged.');
      document.querySelector<HTMLButtonElement>('[data-pick-code]')?.focus({ preventScroll:matchMedia('(min-width:961px)').matches });
    }
  });
  return {
    cancel,
    start(allowExpressions: boolean) {
      expressions = allowExpressions; active = true;
      document.getSelection()?.removeAllRanges();
      player.setAttribute('data-code-picking', ''); host.active(true);
      host.message(allowExpressions ? 'Click a line or drag across an expression in the preview. Escape cancels.' : 'Click a code line in the preview. Escape cancels.');
    },
  };
}
