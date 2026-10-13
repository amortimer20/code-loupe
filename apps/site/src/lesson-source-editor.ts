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
    return { getValue: () => source.value, setRuntimeError: (_message: string) => {} };
  }
}
