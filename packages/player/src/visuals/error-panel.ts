import type { ProgramError } from './error-state';

export function renderProgramError(host: HTMLElement, error: ProgramError | null) {
  host.hidden = error === null;
  const text = error ? `⚠ ${error.name} · Line ${error.line}\n${error.message}\n${error.kind === 'syntax' ? 'Program did not start.' : 'Execution stopped.'}` : '';
  // Resize/theme rendering should not repeat the live announcement.
  if (host.textContent !== text) host.textContent = text;
}

/** Overlay annotations are separate from value badges: an error is not a value. */
export function renderErrorTarget(host: HTMLElement, error: ProgramError | null, rect: DOMRect | null, scroll: HTMLElement) {
  if (!error || !rect) return;
  const pane = scroll.getBoundingClientRect();
  const underline = document.createElement('div');
  underline.className = 'error-target';
  underline.style.left = `${rect.left - pane.left + scroll.scrollLeft}px`;
  underline.style.top = `${rect.bottom - pane.top + scroll.scrollTop}px`;
  underline.style.width = `${rect.width}px`;
  host.append(underline);
  if (error.kind !== 'runtime') return;
  const badge = document.createElement('div');
  badge.className = 'badge diagnostic-badge';
  badge.style.left = `${rect.left + rect.width / 2 - pane.left + scroll.scrollLeft}px`;
  badge.style.top = `${rect.top - pane.top + scroll.scrollTop}px`;
  const inner = document.createElement('span');
  inner.className = 'badge-inner';
  inner.textContent = `⚠ ${error.name}`;
  badge.append(inner);
  host.append(badge);
}

export const errorStyles = /* css */ `
.diagnostic[hidden] { display: none; }
.diagnostic {
  padding: 0.55rem 1rem;
  border-top: 1px solid var(--ca-line);
  border-left: 3px solid var(--ca-error);
  background: var(--ca-panel);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.85rem;
  line-height: 1.4;
}
.code-host .line.fault { background: color-mix(in srgb, var(--ca-error) 12%, transparent); }
.arrow.error-marker {
  clip-path: none; background: transparent; color: var(--ca-error);
  text-align: center; font: bold 1.1rem/1.1rem system-ui, sans-serif;
}
.error-target { position: absolute; border-bottom: 2px solid var(--ca-error); }
.diagnostic-badge .badge-inner { border-color: var(--ca-error); color: var(--ca-error); }
`;
