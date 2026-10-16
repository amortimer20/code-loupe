import { chromeStyles } from './chrome';

/** Code-specific styles; the shared frame, panels, caption and controls live in chrome.ts. */
export const styles = chromeStyles + /* css */ `
/* Opt-in bounded viewer: the host supplies a definite height. */
:host([fit]) .ca { height: 100%; box-sizing: border-box; display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto auto; }
:host([fit]) .title { grid-row: 1; }
:host([fit]) .stage { grid-row: 2; min-height: 0; }
:host([fit]) .feedback { grid-row: 3; }
:host([fit]) .console { grid-row: 4; }
:host([fit]) .controls { grid-row: 5; }
:host([fit]) .data { min-height: 0; overflow: auto; }
:host([fit]) .code { min-height: 0; min-width: 0; }
:host([fit]) .code-scroll { height: 100%; min-height: 0; box-sizing: border-box; overflow: auto; }
:host([fit]) .console pre { max-height: 4.2em; }
:host([fit]) .ca.has-error .error { grid-row: 1 / -1; overflow: auto; }
@container (max-width: 640px) {
  :host([fit]) .stage { grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); }
}

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
