import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/editor/browser/coreCommands.js';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js';
import 'monaco-editor/esm/vs/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode.js';
import 'monaco-editor/esm/vs/editor/contrib/tokenization/browser/tokenization.js';
import 'monaco-editor/esm/vs/editor/contrib/indentation/browser/indentation.js';
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/esm/vs/editor/contrib/dropOrPasteInto/browser/copyPasteContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js';
import 'monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import YamlWorker from './yaml.worker?worker';
import { configureMonacoYaml, type JSONSchema } from 'monaco-yaml';
import schema from 'code-loupe/lesson.schema.json';
import { themePresets } from 'code-loupe/themes';
import { isNode, isSeq, LineCounter, parseDocument } from 'yaml';

export function createSourceEditor(source: HTMLTextAreaElement, original: string) {
  const mount = document.querySelector<HTMLElement>('#lesson-editor')!;
  const problems = document.querySelector<HTMLElement>('#editor-problems')!;
  const status = document.querySelector<HTMLElement>('#editor-status')!;
  window.MonacoEnvironment = {
    getWorker: (_moduleId, label) => label === 'yaml' ? new YamlWorker() : new EditorWorker(),
  };
  const yaml = configureMonacoYaml(monaco, {
    enableSchemaRequest: false, hoverSchemaSource: false, yamlVersion: '1.2', format: { enable: false },
    // The schema title is useful metadata, but the language service repeats it
    // above every field description. Keep hovers focused on the field itself.
    schemas: [{ uri: `${location.origin}/lesson.schema.json`, fileMatch: ['**/lesson.yaml'], schema: { ...schema, title: undefined } as JSONSchema }],
  });
  for (const theme of themePresets) {
    const { palette: p, syntax: s } = theme;
    monaco.editor.defineTheme(`loupe-${theme.id}`, {
      base: theme.variant === 'light' ? 'vs' : 'vs-dark', inherit: true,
      rules: [
        { token: 'type', foreground: p.name.slice(1) },
        { token: 'string', foreground: s.string.slice(1) },
        { token: 'number', foreground: s.number.slice(1) },
        { token: 'keyword', foreground: s.keyword.slice(1) },
        { token: 'comment', foreground: s.comment.slice(1) },
        { token: 'operators', foreground: s.operator.slice(1) },
      ],
      colors: {
        'editor.background': p.panel, 'editor.foreground': p.fg,
        'editorLineNumber.foreground': p.muted, 'editorLineNumber.activeForeground': p.fg,
        'editorCursor.foreground': p.accent, 'editor.selectionBackground': `${p.accent}33`,
        'editorWidget.background': p.raised, 'editorWidget.foreground': p.fg,
        'editorWidget.border': p.border, 'editorError.foreground': p.error,
        'editorSuggestWidget.background': p.raised, 'editorSuggestWidget.foreground': p.fg,
        'editorSuggestWidget.selectedBackground': `${p.accent}33`,
        'editorHoverWidget.background': p.raised, 'editorHoverWidget.foreground': p.fg,
      },
    });
  }
  const syncTheme = () => monaco.editor.setTheme(`loupe-${document.documentElement.dataset.theme ?? 'midnight'}`);
  syncTheme();
  const observer = new MutationObserver(syncTheme);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  // Remember the original bytes, including CRLF/mixed line endings, until edited.
  const model = monaco.editor.createModel(original, 'yaml', monaco.Uri.parse('file:///draft/lesson.yaml'));
  model.updateOptions({ tabSize: 2, insertSpaces: true });
  const initialVersion = model.getAlternativeVersionId();
  const getValue = () => model.getAlternativeVersionId() === initialVersion ? original : model.getValue();
  mount.hidden = false;
  const editor = monaco.editor.create(mount, {
    model, automaticLayout: true, ariaLabel: 'Lesson YAML',
    readOnly: source.disabled, minimap: { enabled: false }, scrollBeyondLastLine: false,
    fontFamily: "'Cascadia Code', 'JetBrains Mono', Consolas, monospace", fontSize: 14, lineHeight: 23,
    lineNumbersMinChars: 3, padding: { top: 12, bottom: 12 }, tabSize: 2, insertSpaces: true,
    detectIndentation: false, stickyScroll: { enabled: false },
    autoIndent: 'advanced', formatOnPaste: false, formatOnType: false,
    quickSuggestions: { other: true, strings: true, comments: false },
  });
  source.hidden = true;
  document.querySelector<HTMLElement>('#editor-shortcuts')!.hidden = false;
  mount.dataset.ready = 'true';
  const input = mount.querySelector<HTMLTextAreaElement>('textarea')!;
  input.id = 'lesson-editor-input';
  document.querySelector<HTMLLabelElement>('label[for="lesson-source"]')!.htmlFor = input.id;
  input.setAttribute('aria-describedby', 'editor-help editor-shortcuts lesson-error');
  function syncSourceState() {
    editor.updateOptions({ readOnly: source.disabled });
    if (source.hasAttribute('aria-invalid') || monaco.editor.getModelMarkers({ resource: model.uri }).length) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  const sourceObserver = new MutationObserver(syncSourceState);
  sourceObserver.observe(source, { attributes: true, attributeFilter: ['disabled', 'aria-invalid'] });
  syncSourceState();
  const change = model.onDidChangeContent(() => {
    source.value = getValue();
    source.dispatchEvent(new Event('input', { bubbles: true }));
  });
  function renderProblems() {
    syncSourceState();
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    problems.replaceChildren();
    for (const marker of markers) {
      const item = document.createElement('li');
      const link = document.createElement('button');
      link.type = 'button';
      link.textContent = `Line ${marker.startLineNumber}, column ${marker.startColumn}: ${marker.message}`;
      link.addEventListener('click', () => {
        editor.setPosition({ lineNumber: marker.startLineNumber, column: marker.startColumn });
        editor.revealLineInCenter(marker.startLineNumber);
        editor.focus();
      });
      item.append(link);
      problems.append(item);
    }
    problems.hidden = markers.length === 0;
    const text = markers.length ? `${markers.length} source problem${markers.length === 1 ? '' : 's'}. Select a problem to go to its location.` : 'Source assistance ready.';
    if (status.textContent !== text) status.textContent = text;
  }
  const markers = monaco.editor.onDidChangeMarkers(uris => {
    if (uris.some(uri => uri.toString() === model.uri.toString())) renderProblems();
  });
  renderProblems();
  function setRuntimeError(message: string) {
    const step = /Step (\d+):/.exec(message);
    const counter = new LineCounter();
    const doc = parseDocument(source.value, { lineCounter: counter });
    const steps = doc.get('steps', true);
    const node = step && isSeq(steps) ? steps.items[Number(step[1]) - 1] : undefined;
    const range = isNode(node) ? node.range : undefined;
    const pos = range ? counter.linePos(range[0]) : undefined;
    monaco.editor.setModelMarkers(model, 'lesson-runtime', pos ? [{
      severity: monaco.MarkerSeverity.Error, message, startLineNumber: pos.line, startColumn: pos.col,
      endLineNumber: pos.line, endColumn: model.getLineMaxColumn(pos.line),
    }] : []);
  }
  // A static page has no route lifecycle. Preserve the editor when entering bfcache.
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    observer.disconnect(); sourceObserver.disconnect(); change.dispose(); markers.dispose();
    editor.dispose(); model.dispose(); yaml.dispose();
  });
  return { getValue, setRuntimeError };
}
