import { CodeLoupe } from 'code-loupe';
import './playground.css';
import { enhanceSourceEditor } from './lesson-source-editor';
import type { LanguageChoice } from './authoring/languages';
import { createCodePicker } from './authoring/code-picker';
import { createBuilder } from './authoring/builder';
import { newLesson, readDocument } from './authoring/lesson-document';
import { migrateDraft } from './authoring/draft-migration';

interface SampleOption { id: string; title: string; source: string }
const languages: LanguageChoice[] = JSON.parse(document.querySelector<HTMLElement>('.workspace')!.dataset.languages!);
const samples: SampleOption[] = JSON.parse(document.querySelector<HTMLElement>('.workspace')!.dataset.samples!);
const requested = new URLSearchParams(location.search).get('sample');
const startingNew = new URLSearchParams(location.search).has('new');
const sample = samples.find(s => s.id === requested) ?? samples.find(s => s.id === 'python/numeric-input') ?? samples[0];
const DRAFT_KEY = startingNew ? 'code-loupe:playground-draft:new' : requested ? `code-loupe:playground-draft:${sample.id}` : 'code-loupe:playground-draft';
const WORKING_KEY = `${DRAFT_KEY}:working`;
let workingText: string | null = null;
let workingIsStartingLesson = false;
const editor = document.querySelector<HTMLTextAreaElement>('#lesson-source')!;
const download = document.querySelector<HTMLButtonElement>('#download')!;
const preview = document.querySelector<HTMLElement>('#preview')!;
const status = document.querySelector<HTMLElement>('#preview-status')!;
const error = document.querySelector<HTMLElement>('#lesson-error')!;
const player = new CodeLoupe();
const workspace = document.querySelector<HTMLElement>('.workspace')!;
const desktopLayout = matchMedia('(min-width:961px)');
function syncWorkspaceLayout() {
  player.toggleAttribute('fit', desktopLayout.matches);
  if (desktopLayout.matches) {
    const top = workspace.getBoundingClientRect().top + window.scrollY;
    const height = Math.max(320, (window.visualViewport?.height ?? innerHeight) - top - 16);
    workspace.style.setProperty('--workspace-height', `${height}px`);
  } else workspace.style.removeProperty('--workspace-height');
  assistance?.layout();
}


// Supply inline YAML before connecting so the normal initial load has a source.
const inline = document.createElement('script');
inline.type = 'text/yaml';
let revision = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastError = '';
let draftText = '';
let assistance: Awaited<ReturnType<typeof enhanceSourceEditor>> | undefined;
let builder: ReturnType<typeof createBuilder> | undefined;
let picker: ReturnType<typeof createCodePicker> | undefined;
let mode: 'builder' | 'yaml' = 'builder';
let destination: number | null = null;
let previewReady = false;
const undo = document.querySelector<HTMLButtonElement>('#draft-undo')!;
const redo = document.querySelector<HTMLButtonElement>('#draft-redo')!;
const recovery = document.querySelector<HTMLElement>('#draft-recovery')!;
const migrate = document.querySelector<HTMLButtonElement>('#migrate-draft')!;
function syncRecovery() {
  const plan = migrateDraft(draftText);
  recovery.hidden = !plan;
  migrate.disabled = !assistance || !!plan?.error;
  document.querySelector('#draft-recovery-message')!.textContent = plan?.error
    ? `This draft uses older address syntax. Automatic update is unavailable: ${plan.error} Your draft is preserved; use YAML to repair it.`
    : 'This draft uses older address syntax. Update it to keep your code, values, and captions. The update can be undone.';
}
migrate.addEventListener('click', () => {
  const plan = migrateDraft(draftText);
  if (plan && !plan.error) assistance?.replace(plan.source);
});
const workingRecovery = document.querySelector<HTMLElement>('#working-recovery')!;
const restoreWorking = document.querySelector<HTMLButtonElement>('#restore-working')!;
function syncWorkingRecovery(failed: boolean) {
  workingRecovery.hidden = !failed;
  workingRecovery.querySelector('p')!.textContent = `${workingIsStartingLesson ? 'No earlier working copy is available. Restore uses the starting lesson.' : 'Undo recent edits, or restore the last lesson that successfully previewed.'} Restoring replaces this draft and discards unsaved form entries; Undo brings the draft back.`;
  restoreWorking.disabled = !assistance || workingText === null || workingText === draftText;
}
restoreWorking.addEventListener('click', () => {
  if (workingText !== null && assistance) {
    assistance.replace(workingText);
    builder?.reset();
    destination = mode === 'builder' ? builder?.selectedStep() ?? 0 : null;
    if (mode === 'builder') document.querySelector<HTMLButtonElement>('[data-step="0"], [data-add]')?.focus();
    else assistance.focus();
  }
});
function syncHistory() { undo.disabled = !assistance?.canUndo(); redo.disabled = !assistance?.canRedo(); }
function selectMode(next: 'builder' | 'yaml') {
  picker?.cancel();
  mode = next;
  document.querySelector<HTMLElement>('#builder-pane')!.hidden = mode !== 'builder';
  document.querySelector<HTMLElement>('#source-pane')!.hidden = mode !== 'yaml';
  document.querySelector('#builder-tab')!.setAttribute('aria-selected', String(mode === 'builder'));
  document.querySelector('#yaml-tab')!.setAttribute('aria-selected', String(mode === 'yaml'));
  assistance?.layout();
  if (mode === 'yaml') document.querySelector('#author-scroll')!.scrollTo({ top:0, behavior:'instant' });
  if (mode === 'builder') { builder?.refresh(); if (previewReady) { destination = player.step; builder?.followPreview(player.step, true); } builder?.revealSelected(); }
}
document.querySelector('#builder-tab')!.addEventListener('click', () => selectMode('builder'));
document.querySelector('#yaml-tab')!.addEventListener('click', () => selectMode('yaml'));
undo.addEventListener('click', () => assistance?.undo());
redo.addEventListener('click', () => assistance?.redo());

player.addEventListener('stepchange', () => {
  if (mode !== 'builder' || !previewReady) return;
  destination = player.step;
  builder?.followPreview(player.step);
});
const builderPane = document.querySelector<HTMLElement>('#builder-pane')!;
builderPane.addEventListener('focusin', event => {
  if ((event.target as Element).closest('form')) player.pause();
});


player.addEventListener('lessonerror', (event) => {
  lastError = (event as CustomEvent<{ message: string }>).detail.message;
});

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, draftText);
  } catch {
    // Editing and downloading still work when browser storage is unavailable.
  }
}

async function updatePreview(currentRevision: number) {
  lastError = '';
  const previewSource = draftText;
  inline.textContent = previewSource;
  const loaded = await player.loadLesson(previewSource);
  if (currentRevision !== revision) return;
  previewReady = loaded;
  builder?.syncPicking();
  if (loaded && destination !== null) player.goTo(Math.min(destination, player.total));
  if (loaded && mode === 'builder') builder?.followPreview(player.step);
  preview.style.visibility = '';
  preview.setAttribute('aria-busy', 'false');
  status.textContent = loaded ? `Ready · ${player.total} steps` : 'Check your lesson';
  assistance?.setRuntimeError(loaded ? '' : lastError);
  syncWorkingRecovery(!loaded);
  if (loaded) {
    workingText = previewSource;
    workingIsStartingLesson = false;
    try { localStorage.setItem(WORKING_KEY, workingText); } catch { /* Session recovery still works without storage. */ }
    error.hidden = true;
    error.textContent = '';
    editor.removeAttribute('aria-invalid');
  } else {
    error.textContent = lastError;
    error.hidden = false;
    editor.setAttribute('aria-invalid', 'true');
  }
}

editor.addEventListener('input', () => {
  draftText = assistance?.getValue() ?? editor.value;
  previewReady = false;
  builder?.refresh();
  destination = mode === 'builder' ? builder?.selectedStep() ?? 0 : null;
  previewReady = false;
  syncHistory();
  syncRecovery();
  saveDraft();
  player.pause();
  clearTimeout(timer);
  const currentRevision = ++revision;
  status.textContent = 'Updating preview…';
  preview.setAttribute('aria-busy', 'true');
  preview.style.visibility = 'hidden';
  error.hidden = true;
  editor.removeAttribute('aria-invalid');
  assistance?.setRuntimeError('');
  timer = setTimeout(() => void updatePreview(currentRevision), 400);
});

download.addEventListener('click', () => {
  // Download the exact draft, even when it is incomplete or invalid.
  const url = URL.createObjectURL(new Blob([draftText], { type: 'application/yaml;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = startingNew ? 'lesson-draft.yaml' : `${sample.id.split('/').at(-1)}-draft.yaml`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

async function start() {
  let draft: string | null = null;
  try {
    draft = localStorage.getItem(DRAFT_KEY);
    workingText = localStorage.getItem(WORKING_KEY);
  } catch {
    // Start with the example when browser storage is unavailable.
  }
  if (draft === null && startingNew) {
    draft = newLesson;
    document.querySelector('#draft-context')!.textContent = 'New lessons have a separate browser draft. Apply your changes to save them, and download a copy to keep.';
  } else if (draft === null) {
    try {
      const response = await fetch(sample.source);
      if (!response.ok) throw new Error(`Example returned ${response.status}.`);
      draft = await response.text();
    } catch {
      draft = 'language: python\ncode: |\n  x = 5\nsteps:\n  - line: 1\n    assign: { var: x, value: 5 }\n';
      document.querySelector('#draft-context')!.textContent = 'The sample could not be loaded. Starting a small new lesson instead.';
    }
  } else {
    document.querySelector('#draft-context')!.textContent = startingNew ? 'Restored your new-lesson draft.' : `Restored your saved draft of “${sample.title}”. The published sample is unchanged.`;
  }
  if (requested && !samples.some(s => s.id === requested)) {
    document.querySelector('#draft-context')!.textContent = `Unknown sample. Using “${sample.title}” instead.`;
  }
  // A pre-checkpoint saved draft may already be broken. Offer the published
  // starting lesson as recovery, without replacing or discarding that draft.
  if (workingText === null) {
    workingIsStartingLesson = true;
    if (startingNew) workingText = newLesson;
    else {
      try {
        const response = await fetch(sample.source);
        if (response.ok) workingText = await response.text();
      } catch { /* Undo remains available when the starting sample cannot load. */ }
    }
  }
  editor.value = draft;
  draftText = draft;
  inline.textContent = draft;
  player.append(inline);
  preview.append(player);
  // Let connectedCallback's queued initial load start before loading the preview.
  await Promise.resolve();
  await updatePreview(revision);
  editor.disabled = false;
  download.disabled = false;
  assistance = await enhanceSourceEditor(editor, () => draftText);
  syncRecovery();
  syncWorkingRecovery(!previewReady);
  assistance.setRuntimeError(lastError);
  builder = createBuilder(document.querySelector<HTMLElement>('#builder-pane')!, {
    languages,
    source: () => draftText,
    edit(source, step) { destination = step; assistance!.replace(source); },
    select(step) { destination = step; if (previewReady) player.goTo(Math.min(step, player.total)); },
    yaml() { selectMode('yaml'); assistance!.focusStep(builder?.selectedStep() ?? 1); },
    canPick: () => mode === 'builder' && previewReady,
    cancelPick: () => picker?.cancel(),
    pick(expressions) { if (mode === 'builder' && previewReady) { player.pause(); picker?.start(expressions); } },
  });
  picker = createCodePicker(player, {
    code: () => String(readDocument(draftText).get('code') ?? ''),
    choose: target => builder!.applyCodeTarget(target),
    message(text) { const message = document.querySelector('[data-code-pick-status]'); if (message) message.textContent = text; },
    active: on => builder?.syncPicking(on),
  });
  selectMode(mode);
  syncHistory();
}

// Observe headings rather than the sized panes, avoiding a resize feedback loop.
const layoutObserver = new ResizeObserver(syncWorkspaceLayout);
layoutObserver.observe(document.querySelector('.site-header')!);
layoutObserver.observe(document.querySelector('.playground-heading')!);
window.addEventListener('resize', syncWorkspaceLayout);
window.visualViewport?.addEventListener('resize', syncWorkspaceLayout);
syncWorkspaceLayout();
void start();
