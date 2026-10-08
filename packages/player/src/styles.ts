export const styles = /* css */ `
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

/* ---- Stage: variables + code ---- */
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

/* ---- Code ---- */
.code-scroll {
  position: relative;
  overflow-x: auto;
  padding: 1.25rem 1rem 0.5rem 0;
}
.code-host pre {
  margin: 0;
  background: transparent !important;
  font-family: var(--ca-font);
  font-size: 1.05rem;
  line-height: 3;
  counter-reset: ln;
}
.vars, .code-host, .console pre, .badge-inner { font-variant-ligatures: none; }
.code-host code { display: block; width: max-content; min-width: 100%; font: inherit; }
.code-host .line {
  display: block;
  position: relative;
  min-height: 3em;
  padding: 0 1rem 0 4.75rem;
  border-radius: 0;
  counter-increment: ln;
  transition: background-color var(--ca-line-ms, 500ms);
}
.code-host .line::before {
  content: counter(ln);
  position: absolute;
  left: 2.4rem;
  width: 1.6rem;
  text-align: right;
  opacity: 0.35;
}
.code-host .line.active {
  background: color-mix(in srgb, var(--ca-accent) 14%, transparent);
}

.arrow {
  position: absolute;
  top: 0;
  left: 0.5rem;
  width: 1.6rem;
  height: 1.1rem;
  margin-top: -0.55rem;
  background: var(--ca-accent);
  clip-path: polygon(0 32%, 55% 32%, 55% 0, 100% 50%, 55% 100%, 55% 68%, 0 68%);
  opacity: 0;
  transition: transform var(--ca-line-ms, 500ms) cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s;
}
.arrow.visible { opacity: 1; }
.instant, .instant * { transition: none !important; }

.badges {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.badge {
  position: absolute;
  transform: translate(-50%, calc(-100% - 2px));
  white-space: nowrap;
}
.badge-inner {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5ch;
  padding: 0.05rem 0.45rem;
  font-family: var(--ca-font);
  font-size: 0.95rem;
  line-height: 1.45;
  white-space: nowrap;
  background: var(--ca-raised);
  border: 1px solid color-mix(in srgb, var(--ca-accent) 65%, transparent);
  border-radius: 0;
}

/* ---- Caption ---- */
.caption {
  min-height: 1.4em;
  padding: 0.65rem 1rem;
  border-top: 1px solid var(--ca-line);
  line-height: 1.4;
}
.caption:empty::before { content: '\\00a0'; }

/* ---- Console ---- */
.console {
  padding: 0.6rem 1rem 0.75rem;
  border-top: 1px solid var(--ca-line);
  background: var(--ca-panel);
}
.console pre {
  margin: 0;
  min-height: 2.8em;
  max-height: 10em;
  overflow: auto;
  font-family: var(--ca-font);
  font-size: 1rem;
  line-height: 1.4;
  white-space: pre-wrap;
}
.console .in {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  white-space: pre;
  color: var(--ca-input);
}
.console .enter {
  margin-left: 0.6ch;
  padding: 0 0.35em;
  font-family: system-ui, sans-serif;
  font-size: 0.7em;
  border: 1px solid var(--ca-line);
  border-radius: 0;
  opacity: 0.75;
}

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

/* ---- Animation overlay + errors ---- */
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.ghost { position: absolute; margin: 0; z-index: 1; }
.ghost .typed { color: var(--ca-input); }

.error {
  margin: 0;
  padding: 1rem;
  color: var(--ca-error);
  font-family: var(--ca-font);
  white-space: pre-wrap;
}
.ca.has-error > :not(.error) { display: none; }

/* Animations off (viewer's toggle, page setting, or the OS reduce-motion setting). */
.ca.reduced .arrow,
.ca.reduced .code-host .line { transition: none; }
`;
