import type { StoredValue } from '../lesson';
import type { BadgeOrigin, Snapshot } from '../state';
import { isReference } from '../values';
import type { AnimationContext, CapturedValue } from './call-stack-panel';
import { animateCollectionAppend, animateCollectionRemoval, animateCollectionUpdate, type CapturedCell } from './collection';
import { badgeDisplayValue } from './heap-state';
import { escapeHtml, textRect } from './dom';

// Durations at 1× speed; the context divides every one by the current speed.
const POP_MS = 400;
const TYPE_MS_PER_CHAR = 150;

/**
 * What the forward-step animations need from the player: timing, the flight primitive,
 * and lookups for where values live on screen. Animations only decorate a snapshot that
 * is already rendered; they never decide lesson state.
 */
export interface StepAnimationContext extends AnimationContext {
  fly: (html: string, from: DOMRect, to: DOMRect, delay: number, align: 'center' | 'start', dissolve?: boolean) => number;
  printedForm: (value: StoredValue, type: string) => string;
  origin: (from: BadgeOrigin | undefined) => HTMLElement | null;
  varRow: (name: string, frameId: number) => HTMLElement | null;
  collectionRow: (ref: string) => HTMLElement | null;
  console: HTMLElement;
  overlay: HTMLElement;
}

/*
 * Each stage starts at time `t` and returns when it ends, so the stages read as one
 * sequence: console, new badge, conversion, assignment, collection change, removal.
 */

/** Console: input is typed one character at a time; output fades in, or a badge's value flies into it. */
export function animateConsole(ctx: StepAnimationContext, snap: Snapshot, t: number): number {
  const ev = snap.events;
  for (const chunkEl of ctx.console.querySelectorAll<HTMLElement>('.chunk')) {
    const index = Number(chunkEl.dataset.index);
    if (index < ev.consoleFrom) continue;
    const chunk = snap.console[index];
    const typed = chunkEl.querySelector<HTMLElement>('.in');
    if (typed) {
      const n = Math.max(1, chunk.text.length);
      const duration = ctx.ms(n * TYPE_MS_PER_CHAR);
      typed.animate([{ width: '0ch' }, { width: `${n}ch` }], { duration, delay: t, easing: `steps(${n}, end)`, fill: 'backwards' });
      t += duration + ctx.ms(150);
      chunkEl.querySelector('.enter')!.animate([{ opacity: 0, transform: 'scale(1.4)' }, { opacity: 0.75, transform: 'none' }], {
        duration: ctx.ms(250),
        delay: t,
        fill: 'backwards',
      });
      t += ctx.ms(300);
      continue;
    }
    const badge = snap.badges.find((b) => b.id === chunk.fromBadge);
    const source = badge ? ctx.badge(badge.id) : null;
    if (badge && source) {
      const value = badgeDisplayValue(snap, badge.value);
      const landing = textRect(chunkEl, ctx.printedForm(value, badge.type)) ?? chunkEl.getBoundingClientRect();
      t += ctx.fly(ctx.literalHtml(value, badge.type), source.getBoundingClientRect(), landing, t, 'start');
      chunkEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ctx.ms(200), delay: t - ctx.ms(80), fill: 'backwards' });
    } else {
      chunkEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ctx.ms(250), delay: t, fill: 'backwards' });
      t += ctx.ms(250);
    }
  }
  return t;
}

/** A new badge appears above its code, flying in from the console or a variable when it has a source. */
export function animateBadgeAdded(ctx: StepAnimationContext, snap: Snapshot, t: number): number {
  const ev = snap.events;
  if (!ev.badgeAdded) return t;
  const inner = ctx.badge(ev.badgeAdded.id);
  const source = ctx.origin(ev.badgeAdded.from);
  if (inner && source) {
    const html = ev.badgeAdded.from?.kind === 'console' ? `<span class="typed">${escapeHtml(source.textContent ?? '')}</span>` : source.innerHTML;
    t += ctx.fly(html, source.getBoundingClientRect(), inner.getBoundingClientRect(), t, 'center');
    inner.animate([{ opacity: 0, transform: 'scale(0.85)' }, { opacity: 1, transform: 'none' }], {
      duration: ctx.ms(220),
      delay: t - ctx.ms(60),
      easing: 'ease-out',
      fill: 'backwards',
    });
    t += ctx.ms(200);
  } else if (inner) {
    inner.animate(
      [
        { opacity: 0, transform: 'translateY(8px) scale(0.7)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: ctx.ms(POP_MS), delay: t, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.3)', fill: 'backwards' },
    );
    t += ctx.ms(POP_MS);
  }
  return t;
}

/** A badge converts: the old value moves to the new spot and dissolves into the new value. */
export function animateConversion(ctx: StepAnimationContext, snap: Snapshot, oldBadges: Map<number, CapturedValue>, t: number): number {
  const ev = snap.events;
  if (!ev.converted) return t;
  const old = oldBadges.get(ev.converted.id);
  const inner = ctx.badge(ev.converted.id);
  if (old && inner) {
    const flight = ctx.fly(old.html, old.rect, inner.getBoundingClientRect(), t, 'center', true);
    inner.animate(
      [
        { opacity: 0, transform: 'scale(1.5)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: ctx.ms(450), delay: t + flight * 0.7, easing: 'ease-out', fill: 'backwards' },
    );
    t += flight + ctx.ms(150);
  }
  return t;
}

/** A value is stored: it flies from its badge into the Variables panel. */
export function animateAssignment(ctx: StepAnimationContext, snap: Snapshot, t: number): number {
  const ev = snap.events;
  if (!ev.assigned) return t;
  const vars = ev.assigned.frameId === 0 ? snap.vars : snap.frames.find(f => f.id === ev.assigned!.frameId)!.vars;
  const variable = vars.find((v) => v.name === ev.assigned!.name)!;
  const row = ctx.varRow(variable.name, ev.assigned.frameId);
  const valueEl = row?.querySelector<HTMLElement>('.value');
  const source = ev.assigned.fromBadge !== undefined ? ctx.badge(ev.assigned.fromBadge) : null;
  if (row && valueEl) {
    if (ev.assigned.isNew) {
      row.animate([{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], {
        duration: ctx.ms(250),
        delay: t,
        fill: 'backwards',
      });
    }
    if (source && !isReference(variable.value)) {
      t += ctx.fly(ctx.literalHtml(variable.value, variable.type), source.getBoundingClientRect(), valueEl.getBoundingClientRect(), t, 'start');
      valueEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ctx.ms(150), delay: t - ctx.ms(60), fill: 'backwards' });
    }
    row.animate(
      [{ backgroundColor: 'color-mix(in srgb, var(--ca-accent) 35%, transparent)' }, { backgroundColor: 'transparent' }],
      { duration: ctx.ms(900), delay: t, easing: 'ease-out' },
    );
  }
  return t;
}

/** A list element, dictionary field, or instance attribute changes or is appended. */
export function animateCollectionChange(ctx: StepAnimationContext, snap: Snapshot, t: number): number {
  const ev = snap.events;
  if (!(ev.updated || ev.appended)) return t;
  const update = (ev.updated ?? ev.appended)!;
  const key = 'attribute' in update ? update.attribute : 'key' in update ? update.key : undefined;
  const field = key !== undefined;
  const cell = ctx.collectionRow(update.ref)?.querySelector<HTMLElement>(field ? `.object-field[data-key="${CSS.escape(key)}"]` : `.collection-cell[data-index="${'index' in update ? update.index : ''}"]`);
  const value = cell?.querySelector<HTMLElement>(field ? '.field-value' : '.collection-item');
  const source = update.fromBadge !== undefined ? ctx.badge(update.fromBadge) : null;
  if (cell && value) {
    if (ev.appended) animateCollectionAppend(cell, t, ctx.ms(250));
    if (source) {
      t += ctx.fly(value.innerHTML, source.getBoundingClientRect(), value.getBoundingClientRect(), t, 'start');
      value.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ctx.ms(150), delay: t - ctx.ms(60), fill: 'backwards' });
    }
    animateCollectionUpdate(cell, t, ctx.ms(900));
  }
  return t;
}

/** The removed cell fades out in the overlay while the surviving cells move into place. */
export function animateRemoval(ctx: StepAnimationContext, snap: Snapshot, oldCells: CapturedCell[], t: number) {
  const removed = snap.events.removed;
  if (!removed) return;
  const row = ctx.collectionRow(removed.ref);
  if (row) animateCollectionRemoval(row, oldCells, removed.index, ctx.overlay, t, ctx.ms(300));
}
