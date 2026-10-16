import type { ThemePreset } from './themes';

/**
 * Viewer chrome shared by every loupe: frame, title, Variables panel, caption,
 * playback controls, and viewer preferences. DOM-free apart from styles and markup
 * strings, so other players (such as the math loupe) look and behave the same.
 */

export const ICONS = {
  first: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM19 5v14l-10-7z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M8.6 5.4 10 4l8 8-8 8-1.4-1.4 6.6-6.6z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  motion: '<svg viewBox="0 0 24 24"><path d="M15 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM1 8h6v2H1zm1 3h5v2H2zm-1 3h6v2H1z"/></svg>',
};

export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2];
/** Pause between autoplayed steps at 1×, after the previous step's animations finish. */
export const AUTOPLAY_PAUSE_MS = 1600;
export const SPEED_STORAGE_KEY = 'code-loupe:speed';
export const MOTION_STORAGE_KEY = 'code-loupe:motion';

export const CONTROLS_HTML = `
  <nav class="controls" aria-label="Playback">
    <button data-act="first" aria-label="Restart" title="Restart (Home)">${ICONS.first}</button>
    <button data-act="prev" aria-label="Previous step" title="Previous step (←)">${ICONS.prev}</button>
    <button data-act="play" aria-label="Play" title="Play / pause (Space)">${ICONS.play}</button>
    <button data-act="next" aria-label="Next step" title="Next step (→)">${ICONS.next}</button>
    <input class="scrub" type="range" min="0" max="0" value="0" aria-label="Step">
    <span class="counter"></span>
    <button data-act="motion" class="motion" aria-pressed="true">${ICONS.motion}</button>
    <select class="speed" aria-label="Playback speed" title="Playback speed">
      ${SPEEDS.map((s) => `<option value="${s}">${s}×</option>`).join('')}
    </select>
  </nav>`;

/** `--ca-*` custom properties for a starter preset. */
export function paletteTokens(preset: ThemePreset): Record<string, string> {
  const p = preset.palette;
  return { bg: p.bg, fg: p.fg, panel: p.panel, raised: p.raised, muted: p.muted,
    line: p.border, accent: p.accent, name: p.name, input: p.input, error: p.error };
}
export const PALETTE_TOKENS = ['bg', 'fg', 'panel', 'raised', 'muted', 'line', 'accent', 'name', 'input', 'error'];

const REDUCED_MOTION = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
export const reducedMotionQuery = () => REDUCED_MOTION;

/** A viewer's own choice wins, then the page's `motion` attribute, then the OS setting. */
export function animationsOn(motionAttribute: string | null) {
  const choice = readSetting(MOTION_STORAGE_KEY) ?? motionAttribute;
  if (choice === 'full') return true;
  if (choice === 'reduced') return false;
  return !REDUCED_MOTION?.matches;
}

// Viewer preferences live in localStorage, which can be unavailable (private windows,
// blocked site data). Then choices simply aren't remembered.
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered; the current page still uses it.
  }
}

export function readStoredSpeed(): number | null {
  const speed = Number(readSetting(SPEED_STORAGE_KEY));
  return speed > 0 ? speed : null;
}

export const chromeStyles = /* css */ `
.step-status { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
:host {
  display: block;
  container-type: inline-size;
}
:host(:focus-visible) { outline: none; }
:host(:focus-visible) .ca { outline: 2px solid var(--ca-accent); outline-offset: 2px; }

.ca {
  /* --ca-bg and --ca-fg are replaced with the Shiki theme's colors at load. */
  --ca-bg: #1e1e1e;
  --ca-fg: #d4d4d4;
  --ca-accent: #14a085;
  --ca-name: #9cdcfe;
  --ca-input: #dcdcaa;
  --ca-error: #f48771;
  --ca-font: 'JetBrains Mono', 'Cascadia Code', ui-monospace, Consolas, monospace;
  --ca-muted: color-mix(in srgb, var(--ca-fg) 75%, var(--ca-bg));
  --ca-raised: color-mix(in srgb, var(--ca-fg) 9%, var(--ca-bg));
  --ca-line: color-mix(in srgb, var(--ca-fg) 18%, transparent);
  --ca-panel: color-mix(in srgb, var(--ca-fg) 4%, var(--ca-bg));

  position: relative;
  background: var(--ca-bg);
  color: var(--ca-fg);
  border: 1px solid var(--ca-line);
  border-radius: 0;
  overflow: hidden;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.viewer-actions { position: absolute; top: 0.3rem; right: 0.4rem; z-index: 2; }

.title {
  padding: 0.6rem 1rem;
  font-weight: 600;
  border-bottom: 1px solid var(--ca-line);
}

.label {
  margin: 0 0 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ca-muted);
}

/* ---- Stage: data panel + main view ---- */
.stage {
  display: grid;
  grid-template-columns: minmax(10rem, 16rem) minmax(0, 1fr);
}
@container (max-width: 640px) {
  .stage { grid-template-columns: minmax(0, 1fr); }
  .data { order: 2; border-right: 0 !important; border-top: 1px solid var(--ca-line); }
}

.data {
  padding: 0.75rem 1rem;
  background: var(--ca-panel);
  border-right: 1px solid var(--ca-line);
}
.vars {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-family: var(--ca-font);
}
.vars:empty::before {
  content: 'None yet';
  font-family: system-ui, sans-serif;
  font-size: 0.85rem;
  font-style: italic;
  opacity: 0.5;
}
.var {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.6ch;
  padding: 0.2rem 0.4rem;
  margin: 0 -0.4rem;
  border-radius: 0;
}
.var .name { color: var(--ca-name); }
.var .eq { opacity: 0.7; }
.var .value { display: inline-block; }

.tag {
  font-family: system-ui, sans-serif;
  font-size: 0.65rem;
  line-height: 1.5;
  padding: 0 0.4rem;
  border: 1px solid var(--ca-line);
  border-radius: 0;
  opacity: 0.8;
}
.var .tag { margin-left: auto; }

/* ---- Caption ---- */
.caption {
  min-height: 1.4em;
  padding: 0.65rem 1rem;
  border-top: 1px solid var(--ca-line);
  line-height: 1.4;
}
.caption:empty::before { content: '\\00a0'; }

/* ---- Controls ---- */
.controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.6rem;
  border-top: 1px solid var(--ca-line);
  background: var(--ca-panel);
}
.controls button {
  all: unset;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0;
  color: var(--ca-fg);
  cursor: pointer;
}
.controls button:hover:not(:disabled) { background: color-mix(in srgb, var(--ca-fg) 12%, transparent); }
.controls button:focus-visible { outline: 2px solid var(--ca-accent); outline-offset: 1px; }
.controls button:disabled { opacity: 0.3; cursor: default; }
.controls svg { width: 1.15rem; height: 1.15rem; fill: currentColor; }
.controls .motion[aria-pressed='true'] { color: var(--ca-accent); }
.controls .motion[aria-pressed='false'] { opacity: 0.5; }
.controls .motion[aria-pressed='false']::after {
  content: '';
  position: absolute;
  width: 1.4rem;
  height: 2px;
  background: currentColor;
  transform: rotate(-45deg);
}
.scrub { flex: 1; min-width: 3rem; margin: 0 0.5rem; accent-color: var(--ca-accent); }
.counter {
  min-width: 5.5em;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  opacity: 0.8;
}
.speed {
  margin-left: 0.5rem;
  padding: 0.3rem 0.4rem;
  font: inherit;
  font-size: 0.85rem;
  color: var(--ca-fg);
  background: var(--ca-bg);
  border: 1px solid var(--ca-line);
  border-radius: 0;
  cursor: pointer;
}
.speed:focus-visible { outline: 2px solid var(--ca-accent); outline-offset: 1px; }
.speed option { background: var(--ca-bg); color: var(--ca-fg); }
@container (max-width: 480px) {
  .counter { display: none; }
}
`;
