import { codeToHtml } from 'shiki';
import { parseLesson, type Lesson, type Value } from './lesson';
import { buildSnapshots, findNth, type BadgeOrigin, type Snapshot } from './state';
import { formatValue } from './values';
import { styles } from './styles';

const DEFAULT_THEME = 'dark-plus';

// Durations at 1× speed. Every animation is divided by the current speed.
const LINE_MS = 500;
const MOVE_MS = 800;
const POP_MS = 400;
const TYPE_MS_PER_CHAR = 150;
const AUTOPLAY_PAUSE_MS = 1600;

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2];
const SPEED_STORAGE_KEY = 'code-loupe:speed';
const MOTION_STORAGE_KEY = 'code-loupe:motion';

const ICONS = {
  first: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM19 5v14l-10-7z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M8.6 5.4 10 4l8 8-8 8-1.4-1.4 6.6-6.6z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
  motion: '<svg viewBox="0 0 24 24"><path d="M15 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM1 8h6v2H1zm1 3h5v2H2zm-1 3h6v2H1z"/></svg>',
};

const TEMPLATE = `
<style>${styles}</style>
<div class="ca" part="container">
  <div class="title" hidden></div>
  <div class="stage">
    <section class="data" aria-label="Variables">
      <h3 class="label">Variables</h3>
      <div class="vars"></div>
    </section>
    <section class="code" aria-label="Code">
      <div class="code-scroll">
        <div class="arrow" aria-hidden="true"></div>
        <div class="code-host"></div>
        <div class="badges" aria-hidden="true"></div>
      </div>
    </section>
  </div>
  <div class="caption" aria-live="polite"></div>
  <section class="console" aria-label="Console">
    <h3 class="label">Console</h3>
    <pre></pre>
  </section>
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
  </nav>
  <div class="overlay" aria-hidden="true"></div>
  <pre class="error" role="alert" hidden></pre>
</div>`;

/**
 * <code-loupe src="lesson.yaml"> — or put the YAML inside a
 * <script type="text/yaml"> child. Attributes: src, theme (any Shiki theme), speed,
 * motion ("full" to animate even when the OS asks for reduced motion), no-keyboard.
 * Fires `stepchange` with { step, total }. Methods: next(), prev(), goTo(n), play(), pause().
 */
export class CodeLoupe extends HTMLElement {
  static observedAttributes = ['src', 'theme', 'speed', 'motion'];

  #root = this.attachShadow({ mode: 'open' });
  #lesson: Lesson | null = null;
  #snapshots: Snapshot[] = [];
  #index = 0;
  #literals = new Map<string, string>();
  #loadId = 0;
  #loadQueued = false;
  #playing = false;
  #playTimer: ReturnType<typeof setTimeout> | undefined;
  #speed = 1;
  #resizeObserver = new ResizeObserver(() => this.#render(false));
  #els: {
    ca: HTMLElement;
    title: HTMLElement;
    vars: HTMLElement;
    scroll: HTMLElement;
    arrow: HTMLElement;
    codeHost: HTMLElement;
    badges: HTMLElement;
    caption: HTMLElement;
    console: HTMLElement;
    play: HTMLButtonElement;
    motion: HTMLButtonElement;
    first: HTMLButtonElement;
    prev: HTMLButtonElement;
    next: HTMLButtonElement;
    scrub: HTMLInputElement;
    counter: HTMLElement;
    speed: HTMLSelectElement;
    overlay: HTMLElement;
    error: HTMLElement;
  };

  constructor() {
    super();
    this.#root.innerHTML = TEMPLATE;
    const $ = <T extends HTMLElement>(selector: string) => this.#root.querySelector(selector) as T;
    this.#els = {
      ca: $('.ca'),
      title: $('.title'),
      vars: $('.vars'),
      scroll: $('.code-scroll'),
      arrow: $('.arrow'),
      codeHost: $('.code-host'),
      badges: $('.badges'),
      caption: $('.caption'),
      console: $('.console pre'),
      play: $('[data-act=play]'),
      motion: $('[data-act=motion]'),
      first: $('[data-act=first]'),
      prev: $('[data-act=prev]'),
      next: $('[data-act=next]'),
      scrub: $('.scrub'),
      counter: $('.counter'),
      speed: $('.speed'),
      overlay: $('.overlay'),
      error: $('.error'),
    };
    this.speed = readStoredSpeed() ?? 1;
    this.#els.speed.addEventListener('change', () => {
      this.speed = Number(this.#els.speed.value);
      storeSetting(SPEED_STORAGE_KEY, String(this.speed));
    });
    REDUCED_MOTION.addEventListener('change', () => this.#renderMotion());
    this.#renderMotion();

    $('.controls').addEventListener('click', (e) => {
      const act = (e.target as Element).closest('button')?.dataset.act;
      if (act === 'play') return this.#playing ? this.pause() : this.play();
      if (act === 'motion') {
        const on = !this.animationsOn;
        storeSetting(MOTION_STORAGE_KEY, on ? 'full' : 'reduced');
        return this.#renderMotion();
      }
      this.pause();
      if (act === 'first') this.goTo(0);
      else if (act === 'prev') this.prev();
      else if (act === 'next') this.next();
    });
    this.#els.scrub.addEventListener('input', () => {
      this.pause();
      this.goTo(Number(this.#els.scrub.value));
    });
    this.addEventListener('keydown', (e) => this.#onKey(e));
  }

  connectedCallback() {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.#resizeObserver.observe(this);
    this.#queueLoad();
  }

  disconnectedCallback() {
    this.#resizeObserver.disconnect();
    this.pause();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (name === 'speed') {
      // A viewer's own saved choice wins over the page's default.
      if (readStoredSpeed() === null && value !== null) this.speed = Number(value);
      return;
    }
    if (name === 'motion') return this.#renderMotion();
    if (this.isConnected) this.#queueLoad();
  }

  /** Playback speed multiplier; 1 is normal, 0.5 is half speed. */
  get speed() {
    return this.#speed;
  }

  set speed(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    this.#speed = value;
    this.#els.ca.style.setProperty('--ca-line-ms', `${LINE_MS / value}ms`);
    const { speed } = this.#els;
    if (!SPEEDS.includes(value) && ![...speed.options].some((o) => Number(o.value) === value)) {
      speed.add(new Option(`${value}×`, String(value)));
    }
    speed.value = String(value);
  }

  /**
   * Whether steps animate. A viewer's own toggle wins; then the page's `motion` attribute;
   * otherwise the operating system's reduce-motion setting decides.
   */
  get animationsOn() {
    const choice = readSetting(MOTION_STORAGE_KEY) ?? this.getAttribute('motion');
    if (choice === 'full') return true;
    if (choice === 'reduced') return false;
    return !REDUCED_MOTION.matches;
  }

  #renderMotion() {
    const on = this.animationsOn;
    const { motion, ca } = this.#els;
    motion.setAttribute('aria-pressed', String(on));
    motion.setAttribute('aria-label', 'Animations');
    motion.title = on ? 'Animations on (click to turn off)' : 'Animations off (click to turn on)';
    ca.classList.toggle('reduced', !on);
  }

  // ---- Public API ----

  get step() {
    return this.#index;
  }

  get total() {
    return Math.max(0, this.#snapshots.length - 1);
  }

  /** Load authored YAML directly. Returns false on an error or a superseded load. */
  loadLesson(source: string): Promise<boolean> {
    return this.#load(source);
  }

  goTo(step: number) {
    const target = Math.max(0, Math.min(this.total, Math.round(step)));
    if (target === this.#index && this.#lesson) return;
    const animate = target === this.#index + 1 && this.animationsOn;
    this.#index = target;
    this.#render(animate);
    this.dispatchEvent(new CustomEvent('stepchange', { detail: { step: this.#index, total: this.total }, bubbles: true }));
  }

  next() {
    this.goTo(this.#index + 1);
  }

  prev() {
    this.goTo(this.#index - 1);
  }

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

  // ---- Loading ----

  #queueLoad() {
    if (this.#loadQueued) return;
    this.#loadQueued = true;
    queueMicrotask(() => {
      this.#loadQueued = false;
      void this.#load();
    });
  }

  async #load(source?: string): Promise<boolean> {
    const loadId = ++this.#loadId;
    this.pause();
    try {
      const lesson = parseLesson(source ?? await this.#readSource());
      const snapshots = buildSnapshots(lesson);
      const theme = this.getAttribute('theme') ?? DEFAULT_THEME;
      const codeHtml = await codeToHtml(lesson.code, { lang: lesson.language, theme });
      const literals = await this.#highlightLiterals(lesson, snapshots, theme);
      if (loadId !== this.#loadId) return false; // a newer load started while we were waiting

      this.#lesson = lesson;
      this.#snapshots = snapshots;
      this.#literals = literals;
      this.#index = 0;

      const { ca, codeHost, title, error, scrub } = this.#els;
      ca.classList.remove('has-error');
      error.hidden = true;
      title.hidden = !lesson.title;
      title.textContent = lesson.title ?? '';
      codeHost.innerHTML = codeHtml;
      // Lines are display:block, so the newlines between them would add blank rows.
      const code = codeHost.querySelector('code');
      code?.childNodes.forEach((node) => node.nodeType === Node.TEXT_NODE && node.remove());
      const pre = codeHost.querySelector('pre');
      if (pre?.style.backgroundColor) ca.style.setProperty('--ca-bg', pre.style.backgroundColor);
      if (pre?.style.color) ca.style.setProperty('--ca-fg', pre.style.color);
      scrub.max = String(this.total);

      this.#render(false);
      this.dispatchEvent(new CustomEvent('stepchange', { detail: { step: 0, total: this.total }, bubbles: true }));
      return true;
    } catch (err) {
      if (loadId !== this.#loadId) return false;
      this.#lesson = null;
      this.#snapshots = [];
      this.#index = 0;
      this.#renderControls();
      this.#els.ca.classList.add('has-error');
      this.#els.error.hidden = false;
      this.#els.error.textContent = `Couldn't load this lesson.\n\n${(err as Error).message}`;
      this.dispatchEvent(new CustomEvent('lessonerror', { detail: { message: (err as Error).message }, bubbles: true }));
      return false;
    }
  }

  async #readSource(): Promise<string> {
    const src = this.getAttribute('src');
    if (src) {
      const response = await fetch(new URL(src, document.baseURI));
      if (!response.ok) throw new Error(`${src} returned ${response.status} ${response.statusText}.`);
      return response.text();
    }
    const inline = this.querySelector('script[type="text/yaml"], script[type="application/yaml"]');
    if (inline?.textContent) return dedent(inline.textContent);
    throw new Error('Set a `src` attribute or put the lesson in a <script type="text/yaml"> child.');
  }

  /** Highlight every value that can appear so badges and variables match the code's colors. */
  async #highlightLiterals(lesson: Lesson, snapshots: Snapshot[], theme: string) {
    const texts = new Set<string>();
    for (const snap of snapshots) {
      for (const v of [...snap.vars, ...snap.badges]) texts.add(formatValue(v.value, lesson.language, v.type));
      const from = snap.events.converted?.from;
      if (from) texts.add(formatValue(from.value, lesson.language, from.type));
    }
    const entries = await Promise.all(
      [...texts].map(async (text) => [text, await codeToHtml(text, { lang: lesson.language, theme, structure: 'inline' })] as const),
    );
    return new Map(entries);
  }

  // ---- Rendering ----

  #render(animate: boolean) {
    const snap = this.#snapshots[this.#index];
    if (!snap || !this.#lesson) return;

    for (const animation of this.#root.getAnimations()) animation.finish();
    const oldBadges = animate ? this.#captureBadges() : new Map<number, Captured>();
    this.#els.overlay.replaceChildren();

    this.#renderLine(snap, animate);
    this.#renderVars(snap);
    this.#renderBadges(snap);
    this.#renderConsole(snap);
    this.#els.caption.textContent = snap.caption ?? '';
    this.#renderControls();

    if (animate) this.#animateStep(snap, oldBadges);
  }

  #lineEls() {
    return this.#els.codeHost.querySelectorAll<HTMLElement>('.line');
  }

  #renderLine(snap: Snapshot, animate: boolean) {
    const { arrow, scroll } = this.#els;
    const lines = this.#lineEls();
    lines.forEach((el, i) => el.classList.toggle('active', i + 1 === snap.line));
    const lineEl = snap.line ? lines[snap.line - 1] : undefined;

    if (!animate) scroll.classList.add('instant');
    arrow.classList.toggle('visible', !!lineEl);
    if (lineEl) {
      const y = lineEl.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop + lineEl.offsetHeight / 2;
      arrow.style.transform = `translateY(${y}px)`;
    }
    if (!animate) {
      void scroll.offsetWidth; // apply the new position before transitions come back
      scroll.classList.remove('instant');
    }
  }

  #renderVars(snap: Snapshot) {
    const lang = this.#lesson!.language;
    this.#els.vars.replaceChildren(
      ...snap.vars.map((v) => {
        const row = el('div', 'var');
        row.dataset.name = v.name;
        const value = el('span', 'value');
        value.innerHTML = this.#literalHtml(v.value, v.type);
        row.append(el('span', 'name', v.name), el('span', 'eq', '='), value, el('span', 'tag', v.type));
        row.setAttribute('aria-label', `${v.name} is the ${v.type} ${formatValue(v.value, lang, v.type)}`);
        return row;
      }),
    );
  }

  #renderBadges(snap: Snapshot) {
    const scrollRect = this.#els.scroll.getBoundingClientRect();
    this.#els.badges.replaceChildren(
      ...snap.badges.map((b) => {
        const rect = this.#targetRect(b.line, b.over, b.nth);
        const badge = el('div', 'badge');
        badge.dataset.id = String(b.id);
        if (rect) {
          badge.style.left = `${rect.left + rect.width / 2 - scrollRect.left + this.#els.scroll.scrollLeft}px`;
          badge.style.top = `${rect.top - scrollRect.top + this.#els.scroll.scrollTop}px`;
        }
        badge.append(this.#badgeInner(b.value, b.type));
        return badge;
      }),
    );
  }

  #badgeInner(value: Value, type: string) {
    const inner = el('span', 'badge-inner');
    inner.innerHTML = this.#literalHtml(value, type);
    inner.append(el('span', 'tag', type));
    return inner;
  }

  #renderConsole(snap: Snapshot) {
    const pre = this.#els.console;
    pre.replaceChildren(
      ...snap.console.map((chunk, i) => {
        const span = el('span', 'chunk');
        span.dataset.index = String(i);
        if (chunk.kind === 'out') {
          span.textContent = chunk.text;
        } else {
          span.append(el('span', 'in', chunk.text), el('kbd', 'enter', '↵ Enter'), '\n');
        }
        return span;
      }),
    );
    pre.scrollTop = pre.scrollHeight;
  }

  #renderControls() {
    const { play, first, prev, next, scrub, counter } = this.#els;
    const atStart = this.#index === 0;
    const atEnd = this.#index >= this.total;
    first.disabled = prev.disabled = atStart;
    next.disabled = atEnd;
    play.innerHTML = this.#playing ? ICONS.pause : ICONS.play;
    play.setAttribute('aria-label', this.#playing ? 'Pause' : 'Play');
    scrub.value = String(this.#index);
    counter.textContent = `Step ${this.#index} / ${this.total}`;
  }

  // ---- Animation (forward steps only; everything else renders instantly) ----

  #ms(base: number) {
    return base / this.#speed;
  }

  #animateStep(snap: Snapshot, oldBadges: Map<number, Captured>) {
    const ev = snap.events;
    // Let the arrow arrive at the new line before anything on it happens.
    let t = ev.lineChanged ? this.#ms(LINE_MS) : 0;

    // 1. Console: input is typed one character at a time; output fades in, or a badge's value flies into it.
    for (const chunkEl of this.#els.console.querySelectorAll<HTMLElement>('.chunk')) {
      const index = Number(chunkEl.dataset.index);
      if (index < ev.consoleFrom) continue;
      const chunk = snap.console[index];
      const typed = chunkEl.querySelector<HTMLElement>('.in');
      if (typed) {
        const n = Math.max(1, chunk.text.length);
        const duration = this.#ms(n * TYPE_MS_PER_CHAR);
        typed.animate([{ width: '0ch' }, { width: `${n}ch` }], { duration, delay: t, easing: `steps(${n}, end)`, fill: 'backwards' });
        t += duration + this.#ms(150);
        chunkEl.querySelector('.enter')!.animate([{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 0.75, transform: 'none' }], {
          duration: this.#ms(250),
          delay: t,
          fill: 'backwards',
        });
        t += this.#ms(300);
        continue;
      }
      const badge = snap.badges.find((b) => b.id === chunk.fromBadge);
      const source = badge ? this.#badgeInnerEl(badge.id) : null;
      if (badge && source) {
        const landing = textRect(chunkEl, this.#printedForm(badge.value, badge.type)) ?? chunkEl.getBoundingClientRect();
        t += this.#fly(this.#literalHtml(badge.value, badge.type), source.getBoundingClientRect(), landing, t, 'start');
        chunkEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: this.#ms(200), delay: t - this.#ms(80), fill: 'backwards' });
      } else {
        chunkEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: this.#ms(250), delay: t, fill: 'backwards' });
        t += this.#ms(250);
      }
    }

    // 2. A new badge appears above its code, flying in from the console or a variable when it has a source.
    if (ev.badgeAdded) {
      const inner = this.#badgeInnerEl(ev.badgeAdded.id);
      const source = this.#originEl(ev.badgeAdded.from);
      if (inner && source) {
        const html = ev.badgeAdded.from?.kind === 'console' ? `<span class="typed">${escapeHtml(source.textContent ?? '')}</span>` : source.innerHTML;
        t += this.#fly(html, source.getBoundingClientRect(), inner.getBoundingClientRect(), t, 'center');
        inner.animate([{ opacity: 0, transform: 'scale(0.85)' }, { opacity: 1, transform: 'none' }], {
          duration: this.#ms(220),
          delay: t - this.#ms(60),
          easing: 'ease-out',
          fill: 'backwards',
        });
        t += this.#ms(200);
      } else if (inner) {
        inner.animate(
          [
            { opacity: 0, transform: 'translateY(8px) scale(0.7)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: this.#ms(POP_MS), delay: t, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.3)', fill: 'backwards' },
        );
        t += this.#ms(POP_MS);
      }
    }

    // 3. A badge converts: the old value moves to the new spot and dissolves into the new value.
    if (ev.converted) {
      const old = oldBadges.get(ev.converted.id);
      const inner = this.#badgeInnerEl(ev.converted.id);
      if (old && inner) {
        const flight = this.#fly(old.html, old.rect, inner.getBoundingClientRect(), t, 'center', true);
        inner.animate(
          [
            { opacity: 0, transform: 'scale(1.5)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: this.#ms(450), delay: t + flight * 0.7, easing: 'ease-out', fill: 'backwards' },
        );
        t += flight + this.#ms(150);
      }
    }

    // 4. A value is stored: it flies from its badge into the Variables panel.
    if (ev.assigned) {
      const variable = snap.vars.find((v) => v.name === ev.assigned!.name)!;
      const row = this.#varRow(variable.name);
      const valueEl = row?.querySelector<HTMLElement>('.value');
      const source = ev.assigned.fromBadge !== undefined ? this.#badgeInnerEl(ev.assigned.fromBadge) : null;
      if (row && valueEl) {
        if (ev.assigned.isNew) {
          row.animate([{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], {
            duration: this.#ms(250),
            delay: t,
            fill: 'backwards',
          });
        }
        if (source) {
          t += this.#fly(this.#literalHtml(variable.value, variable.type), source.getBoundingClientRect(), valueEl.getBoundingClientRect(), t, 'start');
          valueEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: this.#ms(150), delay: t - this.#ms(60), fill: 'backwards' });
        }
        row.animate(
          [{ backgroundColor: 'color-mix(in srgb, var(--ca-accent) 35%, transparent)' }, { backgroundColor: 'transparent' }],
          { duration: this.#ms(900), delay: t, easing: 'ease-out' },
        );
      }
    }
  }

  /**
   * Fly a copy of `html` from one rectangle to another along a slight arc, in the overlay.
   * 'center' lands centered on the target; 'start' lines the text up with the target's left edge.
   * `dissolve` shrinks it away on arrival instead of fading in place. Returns the flight time.
   */
  #fly(html: string, from: DOMRect, to: DOMRect, delay: number, align: 'center' | 'start', dissolve = false) {
    const base = this.#els.ca.getBoundingClientRect();
    const ghost = el('span', 'badge-inner ghost');
    ghost.innerHTML = html;
    this.#els.overlay.append(ghost);
    const size = ghost.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(ghost).paddingLeft) + parseFloat(getComputedStyle(ghost).borderLeftWidth);

    const startX = from.left + from.width / 2 - size.width / 2;
    const startY = from.top + from.height / 2 - size.height / 2;
    const endX = align === 'center' ? to.left + to.width / 2 - size.width / 2 : to.left - padding;
    const endY = to.top + to.height / 2 - size.height / 2;
    ghost.style.left = `${startX - base.left}px`;
    ghost.style.top = `${startY - base.top}px`;

    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.hypot(dx, dy);
    const lift = Math.min(48, distance * 0.2);
    const duration = this.#ms(MOVE_MS * (0.55 + Math.min(distance, 700) / 1400));
    const at = (x: number, y: number, scale = 1) => `translate(${x}px, ${y}px) scale(${scale})`;

    ghost
      .animate(
        [
          { transform: at(0, 0, 0.9), opacity: 0 },
          { transform: at(0, 0), opacity: 1, offset: 0.1 },
          { transform: at(dx / 2, dy / 2 - lift, 1.1), opacity: 1, offset: 0.5 },
          { transform: at(dx, dy), opacity: 1, offset: 0.92 },
          dissolve ? { transform: at(dx, dy - 6, 0.6), opacity: 0 } : { transform: at(dx, dy), opacity: 0 },
        ],
        { duration, delay, easing: 'ease-in-out', fill: 'backwards' },
      )
      .finished.then(() => ghost.remove(), () => ghost.remove());
    return duration;
  }

  /** The element a badge's value comes from: the user's typed input, or a variable's value. */
  #originEl(from: BadgeOrigin | undefined) {
    if (from?.kind === 'console') return this.#els.console.querySelector<HTMLElement>(`.chunk[data-index="${from.chunk}"] .in`);
    if (from?.kind === 'var') return this.#varRow(from.name)?.querySelector<HTMLElement>('.value') ?? null;
    return null;
  }

  #varRow(name: string) {
    return this.#els.vars.querySelector<HTMLElement>(`[data-name="${CSS.escape(name)}"]`);
  }

  /** How a value looks when printed: strings lose their quotes. */
  #printedForm(value: Value, type: string) {
    return typeof value === 'string' ? value : formatValue(value, this.#lesson!.language, type);
  }

  #captureBadges() {
    const captured = new Map<number, Captured>();
    for (const badge of this.#els.badges.querySelectorAll<HTMLElement>('.badge')) {
      const inner = badge.querySelector<HTMLElement>('.badge-inner')!;
      captured.set(Number(badge.dataset.id), { rect: inner.getBoundingClientRect(), html: inner.innerHTML });
    }
    return captured;
  }

  #badgeInnerEl(id: number) {
    return this.#els.badges.querySelector<HTMLElement>(`.badge[data-id="${id}"] .badge-inner`);
  }

  /** Screen rectangle of the nth occurrence of `text` on a line of the highlighted code. */
  #targetRect(line: number, text: string, nth: number): DOMRect | null {
    const lineEl = this.#lineEls()[line - 1];
    if (!lineEl) return null;
    const start = findNth(lineEl.textContent ?? '', text, nth);
    if (start < 0) return lineEl.getBoundingClientRect();
    const range = document.createRange();
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let startSet = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent!.length;
      if (!startSet && start < offset + length) {
        range.setStart(node, start - offset);
        startSet = true;
      }
      if (startSet && start + text.length <= offset + length) {
        range.setEnd(node, start + text.length - offset);
        break;
      }
      offset += length;
    }
    return range.getBoundingClientRect();
  }

  #literalHtml(value: Value, type: string) {
    const text = formatValue(value, this.#lesson!.language, type);
    return this.#literals.get(text) ?? escapeHtml(text);
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
      }, this.#ms(AUTOPLAY_PAUSE_MS));
    });
  }

  #onKey(e: KeyboardEvent) {
    if (this.hasAttribute('no-keyboard') || e.composedPath()[0] === this.#els.scrub) return;
    if ((e.composedPath()[0] as Element).tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
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

interface Captured {
  rect: DOMRect;
  html: string;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Screen rectangle of `text` inside a container's own text, or null if it isn't there. */
function textRect(container: HTMLElement, text: string): DOMRect | null {
  if (!text) return null;
  const node = [...container.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.includes(text));
  if (!node) return null;
  const start = node.textContent!.indexOf(text);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + text.length);
  return range.getBoundingClientRect();
}

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

// Viewer preferences live in localStorage, which can be unavailable (private windows,
// blocked site data). Then choices simply aren't remembered.
function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered; the current page still uses it.
  }
}

function readStoredSpeed(): number | null {
  const speed = Number(readSetting(SPEED_STORAGE_KEY));
  return speed > 0 ? speed : null;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Remove the common indentation from inline YAML so it can be indented to match the page's HTML. */
function dedent(text: string) {
  const lines = text.replace(/^\n+|\s+$/g, '').split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent)).join('\n');
}
