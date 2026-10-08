import type { StoredValue } from '../lesson';
import type { Snapshot } from '../state';
import { isReference } from '../values';
import { renderVariables, type ValueRenderer } from './variables';

export interface CapturedValue { rect: DOMRect; html: string }

interface AnimationContext {
  ms: (duration: number) => number;
  fly: (html: string, from: DOMRect, to: DOMRect, delay: number, align: 'center' | 'start') => number;
  literalHtml: (value: StoredValue, type: string) => string;
  badge: (id: number) => HTMLElement | null;
}

/** Owns the call-stack panel and its forward transitions; state stays in snapshots. */
export class CallStackPanel {
  constructor(readonly host: HTMLElement) {}

  render(snap: Snapshot, enabled: boolean, renderer: ValueRenderer) {
    this.host.hidden = !enabled;
    if (!enabled) {
      this.host.replaceChildren();
      return;
    }
    const label = document.createElement('h3');
    label.className = 'label';
    label.textContent = 'Call stack';
    const frames = [...snap.frames].reverse().map((frame, i) => {
      const card = this.#card(frame.id, `${frame.name}()`, i === 0);
      const returnTo = document.createElement('div');
      returnTo.className = 'frame-detail';
      returnTo.textContent = `Returns to line ${frame.returnTo.line}`;
      const vars = document.createElement('div');
      vars.className = 'vars';
      renderVariables(vars, frame.vars, renderer, snap.selection, frame.id);
      card.append(returnTo, vars);
      return card;
    });
    const global = this.#card(0, 'Global', !snap.frames.length);
    const detail = document.createElement('div');
    detail.className = 'frame-detail';
    detail.textContent = 'Variables shown above';
    global.append(detail);
    this.host.replaceChildren(label, ...frames, global);
  }

  #card(id: number, name: string, active: boolean) {
    const card = document.createElement('section');
    card.className = 'frame';
    card.dataset.frameId = String(id);
    card.classList.toggle('active', active);
    card.setAttribute('aria-label', `${name} frame, ${active ? 'active' : 'paused'}`);
    const heading = document.createElement('h4');
    heading.className = 'frame-heading';
    heading.textContent = name;
    const status = document.createElement('span');
    status.className = 'frame-status';
    status.textContent = active ? 'Active' : 'Paused';
    heading.append(status);
    card.append(heading);
    return card;
  }

  animate(snap: Snapshot, oldBadges: Map<number, CapturedValue>, delay: number, ctx: AnimationContext) {
    const called = snap.events.called;
    if (called) {
      const card = this.host.querySelector<HTMLElement>(`[data-frame-id="${called.frameId}"]`)!;
      card.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], {
        duration: ctx.ms(250), delay, fill: 'backwards', easing: 'ease-out',
      });
      delay += ctx.ms(250);
      const frame = snap.frames.find(f => f.id === called.frameId)!;
      for (const arg of called.args) {
        const value = card.querySelector<HTMLElement>(`[data-name="${CSS.escape(arg.name)}"] .value`)!;
        const source = arg.fromBadge !== undefined ? oldBadges.get(arg.fromBadge) : undefined;
        if (source) {
          const parameter = frame.vars.find(v => v.name === arg.name)!;
          if (!isReference(parameter.value)) delay += ctx.fly(ctx.literalHtml(parameter.value, parameter.type), source.rect, value.getBoundingClientRect(), delay, 'start');
          value.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ctx.ms(150), delay: delay - ctx.ms(60), fill: 'backwards' });
        }
      }
    }
    const returned = snap.events.returned;
    if (returned) {
      const destination = ctx.badge(returned.badgeId)!;
      const source = returned.fromBadge !== undefined ? oldBadges.get(returned.fromBadge) : undefined;
      if (source) {
        const badge = snap.badges.find(b => b.id === returned.badgeId)!;
        delay += ctx.fly(ctx.literalHtml(badge.value, badge.type), source.rect, destination.getBoundingClientRect(), delay, 'center');
      }
      destination.animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'none' }], {
        duration: ctx.ms(250), delay, fill: 'backwards', easing: 'ease-out',
      });
    }
  }
}

export const callStackStyles = /* css */ `
.call-stack[hidden] { display: none; }
.call-stack { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--ca-line); }
.frame { margin-top: 0.5rem; padding: 0.65rem; border: 1px solid var(--ca-line); border-radius: 0; }
.frame.active { border-color: var(--ca-accent); background: color-mix(in srgb, var(--ca-accent) 8%, transparent); }
.frame-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem; margin: 0; font-size: 0.85rem; overflow-wrap: anywhere; }
.frame-status { font-size: 0.65rem; font-weight: 400; color: var(--ca-muted); }
.frame-detail { font-size: 0.7rem; color: var(--ca-muted); margin: 0.25rem 0; }
.frame .vars { margin-top: 0.5rem; font-size: 0.9rem; }
`;
