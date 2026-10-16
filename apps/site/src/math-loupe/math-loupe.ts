import {
  AUTOPLAY_PAUSE_MS, CONTROLS_HTML, ICONS, MOTION_STORAGE_KEY, PALETTE_TOKENS, SPEED_STORAGE_KEY, SPEEDS,
  animationsOn, chromeStyles, paletteTokens, readStoredSpeed, reducedMotionQuery, storeSetting,
} from 'code-loupe/chrome';
import { getThemePreset } from 'code-loupe/themes';
import { buildMathSnapshots, type MathLesson, type MathSnapshot, type MathVariable } from './expression';
import { MathStage } from './stage';

const DEFAULT_THEME = 'midnight';
/** Variable rows flash when a forward step changes them, like updated list cells in code loupes. */
const FLASH_MS = 800;

const mathStyles = /* css */ `
:host([fit]) .ca { height: 100%; box-sizing: border-box; display: grid; grid-template-rows: auto minmax(0, 1fr) auto auto; }
:host([fit]) .stage { min-height: 0; }
:host([fit]) .data { min-height: 0; overflow: auto; }
:host([fit]) .ml-stage { height: 100%; min-height: 0; }

.expression-pane { min-width: 0; }
/* The stage is the coordinate space for emphasis boxes and departing glyphs. */
.ml-stage { position: relative; display: grid; place-items: center; height: 12rem; padding: 0 1rem; overflow: hidden; font-size: clamp(1.6rem, 5cqi, 3rem); }
.ml-expression { position: relative; z-index: 1; text-align: left; white-space: nowrap; }
.ml-probe { position: absolute; visibility: hidden; width: max-content; }
.ml-stage math { font-family: math; color: var(--ca-fg); }
.ml-ghost { position: absolute; left: 0; top: 0; z-index: 2; pointer-events: none; }
.ml-focus-layer { position: absolute; inset: 0; pointer-events: none; }
.ml-focus-box { position: absolute; box-sizing: border-box; background: var(--ca-raised); box-shadow: inset 0 -3px var(--ca-accent); }
.ml-focus-glyph { color: var(--ca-accent); }
@container (max-width: 640px) { .ml-stage { height: 9rem; } }
`;

const TEMPLATE = `
<style>${chromeStyles}${mathStyles}</style>
<div class="ca" part="container">
  <div class="viewer-actions"><slot name="viewer-actions"></slot></div>
  <div class="title" part="title" hidden></div>
  <div class="stage">
    <div class="data">
      <section aria-label="Variables">
        <h3 class="label">Variables</h3>
        <div class="vars"></div>
      </section>
    </div>
    <section class="expression-pane" aria-label="Expression">
      <div class="ml-stage" role="img"></div>
    </section>
  </div>
  <div class="caption"></div>
  ${CONTROLS_HTML.trimStart()}
  <div class="step-status" role="status" aria-live="polite" aria-atomic="true"></div>
</div>`;

/**
 * <math-loupe> plays a teacher-authored math lesson with the same frame, controls,
 * preferences and keyboard handling as <code-loupe>. Set `lesson` to a MathLesson.
 * Attributes: theme (starter preset), speed, motion, no-keyboard, fit.
 * Fires `stepchange` with { step, total }. Methods: next(), prev(), goTo(n), play(), pause().
 */
export class MathLoupe extends HTMLElement {
  static observedAttributes = ['theme', 'speed', 'motion', 'fit'];

  #root = this.attachShadow({ mode: 'open' });
  #lesson?: MathLesson;
  #snapshots: MathSnapshot[] = [];
  #stage?: MathStage;
  #index = 0;
  #speed = 1;
  #playing = false;
  #playTimer: ReturnType<typeof setTimeout> | undefined;
  #resizeObserver = new ResizeObserver(() => this.#stage?.relayout());
  #els: Record<'ca' | 'title' | 'vars' | 'stage' | 'caption' | 'status' | 'counter', HTMLElement>
    & Record<'play' | 'motion' | 'first' | 'prev' | 'next', HTMLButtonElement>
    & { scrub: HTMLInputElement; speed: HTMLSelectElement };

  constructor() {
    super();
    this.#root.innerHTML = TEMPLATE;
    const $ = <T extends HTMLElement>(selector: string) => this.#root.querySelector(selector) as T;
    this.#els = {
      ca: $('.ca'), title: $('.title'), vars: $('.vars'), stage: $('.ml-stage'), caption: $('.caption'),
      status: $('.step-status'), counter: $('.counter'), play: $('[data-act=play]'), motion: $('[data-act=motion]'),
      first: $('[data-act=first]'), prev: $('[data-act=prev]'), next: $('[data-act=next]'), scrub: $('.scrub'), speed: $('.speed'),
    };
    this.speed = readStoredSpeed() ?? 1;
    this.#els.speed.addEventListener('change', () => {
      this.speed = Number(this.#els.speed.value);
      storeSetting(SPEED_STORAGE_KEY, String(this.speed));
    });
    reducedMotionQuery()?.addEventListener('change', () => this.#renderMotion());
    this.#renderMotion();
    $('.controls').addEventListener('click', (e) => {
      const act = (e.target as Element).closest('button')?.dataset.act;
      if (act === 'play') return this.#playing ? this.pause() : this.play();
      if (act === 'motion') {
        storeSetting(MOTION_STORAGE_KEY, this.animationsOn ? 'reduced' : 'full');
        return this.#renderMotion();
      }
      this.pause();
      if (act === 'first') this.goTo(0);
      else if (act === 'prev') this.prev();
      else if (act === 'next') this.next();
    });
    this.#els.scrub.addEventListener('input', () => {
      const step = Number(this.#els.scrub.value);
      this.pause();
      this.goTo(step);
    });
    this.addEventListener('keydown', (e) => this.#onKey(e));
    this.#applyTheme();
  }

  connectedCallback() {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback() {
    this.#resizeObserver.disconnect();
    this.pause();
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null) {
    if (old === value) return;
    if (name === 'speed') {
      // A viewer's own saved choice wins over the page's default.
      if (readStoredSpeed() === null && value !== null) this.speed = Number(value);
    } else if (name === 'motion') this.#renderMotion();
    else if (name === 'theme') { this.pause(); this.#stage?.settle(); this.#applyTheme(); }
    else if (name === 'fit') this.#stage?.relayout();
  }

  /** Load a lesson and restart at Step 0. Throws on authoring mistakes. */
  set lesson(lesson: MathLesson | undefined) {
    this.pause();
    this.#stage?.settle();
    this.#lesson = lesson;
    this.#snapshots = lesson ? buildMathSnapshots(lesson) : [];
    this.#index = 0;
    this.#stage = lesson ? new MathStage(this.#els.stage, this.#snapshots) : undefined;
    if (!lesson) this.#els.stage.replaceChildren();
    this.#render(false);
    this.dispatchEvent(new CustomEvent('stepchange', { detail: { step: 0, total: this.total }, bubbles: true }));
  }
  get lesson() { return this.#lesson; }

  get step() { return this.#index; }
  get total() { return Math.max(0, this.#snapshots.length - 1); }

  /** Playback speed multiplier; 1 is normal, 0.5 is half speed. */
  get speed() { return this.#speed; }
  set speed(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    this.#speed = value;
    const { speed } = this.#els;
    if (!SPEEDS.includes(value) && ![...speed.options].some((o) => Number(o.value) === value)) speed.add(new Option(`${value}×`, String(value)));
    speed.value = String(value);
    this.#stage?.setRate(value);
  }

  /** Whether steps animate: a viewer's toggle, then the `motion` attribute, then the OS setting. */
  get animationsOn() { return animationsOn(this.getAttribute('motion')); }

  goTo(step: number) {
    if (!this.#lesson) return;
    const target = Math.max(0, Math.min(this.total, Math.round(step)));
    if (target === this.#index && !this.#stage?.animating) return;
    const animate = target === this.#index + 1 && this.animationsOn;
    const before = this.#snapshots[this.#index].variables;
    this.#index = target;
    this.#render(true);
    const shown = this.#stage!.show(target, animate, this.#speed);
    if (animate) this.#flashVariables(before);
    this.#els.ca.dataset.animating = String(animate);
    void shown.then(() => { if (!this.#stage?.animating) this.#els.ca.dataset.animating = 'false'; });
    this.dispatchEvent(new CustomEvent('stepchange', { detail: { step: this.#index, total: this.total }, bubbles: true }));
  }
  next() { this.goTo(this.#index + 1); }
  prev() { this.goTo(this.#index - 1); }

  play() {
    if (!this.#lesson) return;
    if (this.#index >= this.total) this.goTo(0);
    this.#playing = true;
    this.#renderControls();
    this.#scheduleAutoplay();
  }

  pause() {
    this.#playing = false;
    clearTimeout(this.#playTimer);
    this.#renderControls();
  }

  // ---- Rendering ----

  #applyTheme() {
    const preset = getThemePreset(this.getAttribute('theme') ?? DEFAULT_THEME) ?? getThemePreset(DEFAULT_THEME)!;
    const { ca } = this.#els;
    for (const token of PALETTE_TOKENS) ca.style.removeProperty(`--ca-${token}`);
    for (const [token, color] of Object.entries(paletteTokens(preset))) ca.style.setProperty(`--ca-${token}`, color);
    ca.style.colorScheme = preset.variant;
  }

  #renderMotion() {
    const on = this.animationsOn;
    const { motion } = this.#els;
    motion.setAttribute('aria-pressed', String(on));
    motion.setAttribute('aria-label', 'Animations');
    motion.title = on ? 'Animations on (click to turn off)' : 'Animations off (click to turn on)';
    if (!on) this.#stage?.settle();
  }

  #render(announce: boolean) {
    const snapshot = this.#snapshots[this.#index];
    const { title, caption, stage, status } = this.#els;
    title.hidden = !this.#lesson?.title;
    title.textContent = this.#lesson?.title ?? '';
    caption.textContent = snapshot?.caption ?? '';
    stage.setAttribute('aria-label', snapshot?.spoken ?? 'No lesson loaded');
    this.#renderVariables(snapshot?.variables ?? []);
    this.#renderControls();
    if (announce && snapshot) {
      const values = snapshot.variables.map(item => `${item.name} is ${item.value}`).join('. ');
      status.textContent = [`Step ${this.#index} of ${this.total}`, snapshot.spoken, values, snapshot.caption].filter(Boolean).join('. ');
    }
  }

  #renderVariables(variables: MathVariable[]) {
    this.#els.vars.replaceChildren(...variables.map(variable => {
      const unknown = variable.value === 'unknown';
      const row = document.createElement('div'); row.className = 'var'; row.dataset.name = variable.name;
      row.setAttribute('aria-label', `${variable.name}: ${unknown ? 'unknown' : variable.value}`);
      const parts = [['name', variable.name], ['eq', '='], ['value', unknown ? '?' : String(variable.value)], ['tag', unknown ? 'unknown' : 'solved']];
      row.append(...parts.map(([className, text]) => Object.assign(document.createElement('span'), { className, textContent: text })));
      return row;
    }));
  }

  #flashVariables(before: MathVariable[]) {
    for (const variable of this.#snapshots[this.#index].variables) {
      const previous = before.find(item => item.name === variable.name);
      if (!previous || previous.value === variable.value) continue;
      const row = this.#els.vars.querySelector<HTMLElement>(`[data-name="${CSS.escape(variable.name)}"]`);
      row?.animate([{ backgroundColor: 'color-mix(in srgb, var(--ca-accent) 35%, transparent)' }, { backgroundColor: 'transparent' }],
        { duration: FLASH_MS / this.#speed, easing: 'ease-out' });
    }
  }

  #renderControls() {
    const { play, first, prev, next, scrub, counter } = this.#els;
    const atStart = this.#index === 0, atEnd = this.#index >= this.total;
    const focused = this.#root.activeElement;
    first.disabled = prev.disabled = atStart || !this.#lesson;
    next.disabled = atEnd;
    play.disabled = !this.#lesson;
    // A disabled button drops focus; keep keyboard shortcuts usable on the player.
    if ((focused === next && atEnd) || ((focused === first || focused === prev) && atStart)) this.focus({ preventScroll: true });
    play.innerHTML = this.#playing ? ICONS.pause : ICONS.play;
    play.setAttribute('aria-label', this.#playing ? 'Pause' : 'Play');
    scrub.max = String(this.total);
    scrub.value = String(this.#index);
    scrub.setAttribute('aria-valuetext', `Step ${this.#index} of ${this.total}`);
    counter.textContent = `Step ${this.#index} / ${this.total}`;
  }

  // ---- Playback ----

  #scheduleAutoplay() {
    clearTimeout(this.#playTimer);
    if (!this.#playing) return;
    const running = this.#root.getAnimations().map((a) => a.finished.catch(() => {}));
    void Promise.all(running).then(() => {
      if (!this.#playing) return;
      this.#playTimer = setTimeout(() => {
        if (!this.#playing) return;
        if (this.#index >= this.total) return this.pause();
        this.next();
        this.#scheduleAutoplay();
      }, AUTOPLAY_PAUSE_MS / this.#speed);
    });
  }

  #onKey(e: KeyboardEvent) {
    const target = e.composedPath()[0];
    if (this.hasAttribute('no-keyboard') || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey
      || (target instanceof HTMLElement && (target.matches('input, select, textarea') || target.isContentEditable))) return;
    if ((target as Element).tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    const actions: Record<string, () => void> = {
      ArrowRight: () => this.next(),
      ArrowLeft: () => this.prev(),
      Home: () => this.goTo(0),
      End: () => this.goTo(this.total),
      ' ': () => (this.#playing ? this.pause() : this.play()),
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    if (e.key !== ' ') this.pause();
    action();
  }
}

if (!customElements.get('math-loupe')) customElements.define('math-loupe', MathLoupe);
