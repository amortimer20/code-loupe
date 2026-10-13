import { isNode, isSeq, parseDocument } from 'yaml';

/** The raw draft remains canonical; loading an editor never rewrites it. */
export async function enhanceSourceEditor(source: HTMLTextAreaElement, rawDraft: () => string) {
  const status = document.querySelector<HTMLElement>('#editor-status')!;
  try {
    const { createSourceEditor } = await import('./monaco-lesson-editor');
    return createSourceEditor(source, rawDraft());
  } catch {
    source.hidden = false;
    document.querySelector<HTMLElement>('#lesson-editor')!.hidden = true;
    document.querySelector<HTMLElement>('#editor-shortcuts')!.hidden = true;
    document.querySelector<HTMLLabelElement>('#editor-heading label')!.htmlFor = source.id;
    status.textContent = 'Source assistance could not load. You can still edit, preview, and download YAML.';
    const history = [rawDraft()];
    let position = 0, restoring = false;
    source.addEventListener('input', () => {
      if (restoring || source.value === history[position]) return;
      history.splice(position + 1); history.push(source.value); position++;
    }, { capture: true });
    function restore() {
      restoring = true;
      source.value = history[position];
      source.dispatchEvent(new Event('input', { bubbles: true }));
      restoring = false;
    }
    const undo = () => { if (position > 0) { position--; restore(); } };
    const redo = () => { if (position < history.length - 1) { position++; restore(); } };
    source.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    });
    return {
      getValue: () => restoring ? history[position] : source.value,
      setRuntimeError: (_message: string) => {},
      replace(text: string) { if (text !== history[position]) { history.splice(position + 1); history.push(text); position++; restore(); } },
      undo, redo, canUndo: () => position > 0, canRedo: () => position < history.length - 1,
      focus: () => source.focus(), layout: () => {},
      focusStep(step: number) {
        const doc = parseDocument(source.value), steps = doc.get('steps', true), node = isSeq(steps) ? steps.items[step - 1] : undefined;
        if (isNode(node) && node.range) source.setSelectionRange(node.range[0], node.range[0]);
        source.focus();
      },
    };
  }
}
