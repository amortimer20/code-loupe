import { CodeLoupe } from './index';
import './playground.css';

const DRAFT_KEY = 'code-loupe:playground-draft';
const editor = document.querySelector<HTMLTextAreaElement>('#lesson-source')!;
const download = document.querySelector<HTMLButtonElement>('#download')!;
const preview = document.querySelector<HTMLElement>('#preview')!;
const status = document.querySelector<HTMLElement>('#preview-status')!;
const error = document.querySelector<HTMLElement>('#lesson-error')!;
const player = new CodeLoupe();

// Supply inline YAML before connecting so the normal initial load has a source.
const inline = document.createElement('script');
inline.type = 'text/yaml';
let revision = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastError = '';

player.addEventListener('lessonerror', (event) => {
  lastError = (event as CustomEvent<{ message: string }>).detail.message;
});

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, editor.value);
  } catch {
    // Editing and downloading still work when browser storage is unavailable.
  }
}

async function updatePreview(currentRevision: number) {
  lastError = '';
  inline.textContent = editor.value;
  const loaded = await player.loadLesson(editor.value);
  if (currentRevision !== revision) return;
  preview.style.visibility = '';
  preview.setAttribute('aria-busy', 'false');
  status.textContent = loaded ? `Ready · ${player.total} steps` : 'Check your lesson';
  if (loaded) {
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
  saveDraft();
  player.pause();
  clearTimeout(timer);
  const currentRevision = ++revision;
  status.textContent = 'Updating preview…';
  preview.setAttribute('aria-busy', 'true');
  preview.style.visibility = 'hidden';
  error.hidden = true;
  editor.removeAttribute('aria-invalid');
  timer = setTimeout(() => void updatePreview(currentRevision), 400);
});

download.addEventListener('click', () => {
  // Download the exact draft, even when it is incomplete or invalid.
  const url = URL.createObjectURL(new Blob([editor.value], { type: 'application/yaml;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lesson.yaml';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

async function start() {
  let draft: string | null = null;
  try {
    draft = localStorage.getItem(DRAFT_KEY);
  } catch {
    // Start with the example when browser storage is unavailable.
  }
  if (draft === null) {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}lessons/numeric-input.yaml`);
      if (!response.ok) throw new Error(`Example returned ${response.status}.`);
      draft = await response.text();
    } catch {
      draft = 'language: python\ncode: |\n  x = 5\nsteps:\n  - line: 1\n    assign: { var: x, value: 5 }\n';
    }
  }
  editor.value = draft;
  inline.textContent = draft;
  player.append(inline);
  preview.append(player);
  // Let connectedCallback's queued initial load start before loading the preview.
  await Promise.resolve();
  await updatePreview(revision);
  editor.disabled = false;
  download.disabled = false;
}

void start();
