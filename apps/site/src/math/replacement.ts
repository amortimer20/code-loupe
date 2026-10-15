import type { MathTransition } from './examples';

/** Presentation only. The viewer owns authored state, cancellation and final handoff. */
export interface MathAnimation { finished: Promise<void>; cancel(): void; setSpeed(rate: number): void }
function parts(container: HTMLElement, exclude?: HTMLElement) {
  return new Map([...container.querySelectorAll<HTMLElement>('[data-part]')]
    .filter(part => !exclude?.contains(part)).map(part => [part.dataset.part!, part]));
}
function required(map: Map<string, HTMLElement>, id: string) {
  const element = map.get(id);
  if (!element) throw new Error(`Math transition refers to missing display part: ${id}`);
  return element;
}
function track(animations: Animation[], extras: HTMLElement[], speed: number): MathAnimation {
  animations.forEach(animation => { animation.playbackRate = speed; });
  return {
    finished: Promise.allSettled(animations.map(animation => animation.finished)).then(() => {}),
    cancel() { animations.forEach(animation => animation.cancel()); extras.forEach(element => element.remove()); },
    setSpeed(rate) { animations.forEach(animation => animation.updatePlaybackRate(rate)); },
  };
}
function shared(old: Map<string, HTMLElement>, target: Map<string, HTMLElement>, excluded: HTMLElement[] = []) {
  const pairs = [...old].flatMap(([id, source]) => {
    const destination = target.get(id);
    return destination && source.textContent === destination.textContent && !excluded.some(group => group.contains(source))
      ? [{ source, destination }] : [];
  });
  // A retained group moves once, rather than moving both its parent and children.
  return pairs.filter(pair => !pairs.some(parent => parent !== pair && parent.source.contains(pair.source)));
}
function framesShift(x: number, y: number, start: number, end: number, reverse = false): Keyframe[] {
  const shifted = `translate(${x}px, ${y}px)`, zero = 'translate(0, 0)';
  return [{ transform:reverse ? shifted : zero }, { transform:reverse ? shifted : zero, offset:start },
    { transform:reverse ? zero : shifted, offset:end }, { transform:reverse ? zero : shifted }];
}
function paint(node: HTMLElement) {
  const style = getComputedStyle(node);
  return { color:style.color, backgroundColor:style.backgroundColor,
    boxShadow:style.boxShadow === 'none' ? 'inset 0 -2px transparent' : style.boxShadow };
}
function withPaint(frames: Keyframe[], from: ReturnType<typeof paint>, to: ReturnType<typeof paint>) {
  return frames.map((frame, index) => ({ ...frame, ...(index < 2 ? from : to) }));
}
function resultClone(container: HTMLElement, destination: HTMLElement, extras: HTMLElement[]) {
  const bounds = destination.getBoundingClientRect(), parent = container.getBoundingClientRect();
  const clone = destination.cloneNode(true) as HTMLElement;
  clone.removeAttribute('data-part'); clone.classList.add('math-evaluation-flight');
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, { left:`${bounds.left - parent.left}px`, top:`${bounds.top - parent.top}px`,
    width:`${bounds.width}px`, height:`${bounds.height}px`, lineHeight:`${bounds.height}px` });
  container.append(clone); extras.push(clone);
  return { clone, bounds };
}

export function animateMathTransition(container: HTMLElement, preview: HTMLElement, transition: MathTransition, speed = 1): MathAnimation {
  const old = parts(container, preview), target = parts(preview);
  const animations: Animation[] = [], extras: HTMLElement[] = [];
  if (transition.kind === 'introduce') {
    const retained = shared(old, target).map(pair => ({ id:pair.destination.dataset.part!, bounds:pair.source.getBoundingClientRect(), paint:paint(pair.source) }));
    const introduced = transition.parts.map(id => required(target, id));
    // Install the final layout; FLIP keeps existing terms in their old positions initially.
    container.replaceChildren(...preview.children);
    const installed = parts(container);
    const timing: KeyframeAnimationOptions = { duration:1000, easing:'ease-in-out', fill:'both' };
    for (const item of retained) {
      const node = required(installed, item.id), end = node.getBoundingClientRect();
      animations.push(node.animate(withPaint(framesShift(item.bounds.left - end.left, item.bounds.top - end.top, .2, .65, true), item.paint, paint(node)), timing));
    }
    for (const node of introduced) animations.push(node.animate([
      { opacity:0 }, { opacity:0, offset:.4 }, { opacity:1, offset:.75 }, { opacity:1 },
    ], timing));
    return track(animations, extras, speed);
  }

  const groups = transition.evaluations.map(evaluation => ({ source:required(old, evaluation.source), destination:required(target, evaluation.result) }));
  const cancellation = transition.cancellation;
  const cancelledGroup = cancellation ? required(old, cancellation.group) : undefined;
  const retained = shared(old, target, [...groups.map(group => group.source), ...(cancelledGroup ? [cancelledGroup] : [])]);
  container.querySelectorAll('.math-emphasis').forEach(part => { if (!preview.contains(part)) part.classList.remove('math-emphasis'); });
  groups.forEach(group => group.source.classList.add('math-emphasis'));
  const duration = cancellation ? 1800 : 1000;
  const timing: KeyframeAnimationOptions = { duration, easing:'ease-in-out', fill:'both' };
  for (const pair of retained) {
    const start = pair.source.getBoundingClientRect(), end = pair.destination.getBoundingClientRect();
    const dx = end.left - start.left, dy = end.top - start.top;
    if (Math.abs(dx) > .1 || Math.abs(dy) > .1) animations.push(pair.source.animate(withPaint(
      framesShift(dx, dy, cancellation ? .78 : .45, cancellation ? .95 : .85), paint(pair.source), paint(pair.destination)), timing));
  }
  for (const { source, destination } of groups) {
    const start = source.getBoundingClientRect();
    const { clone, bounds:end } = resultClone(container, destination, extras);
    const from = `translateX(${start.left + start.width / 2 - end.left - end.width / 2}px)`;
    animations.push(source.animate([{ opacity:1 }, { opacity:1, offset:.2 }, { opacity:0, offset:.4 }, { opacity:0 }], timing));
    animations.push(clone.animate([
      { opacity:0, transform:from }, { opacity:0, transform:from, offset:.25 },
      { opacity:1, transform:from, offset:.45 }, { opacity:1, transform:'translateX(0)', offset:.85 },
      { opacity:1, transform:'translateX(0)' },
    ], timing));
  }
  if (cancellation && cancelledGroup) {
    const bounds = cancelledGroup.getBoundingClientRect(), parent = container.getBoundingClientRect();
    for (const id of cancellation.terms) {
      const term = required(old, id); term.classList.add('math-emphasis', 'math-cancelled');
      const stroke = document.createElement('span'); stroke.className = 'math-cancel-stroke'; stroke.setAttribute('aria-hidden', 'true');
      term.append(stroke); extras.push(stroke);
      animations.push(stroke.animate([
        { transform:'rotate(-15deg) scaleX(0)' }, { transform:'rotate(-15deg) scaleX(0)', offset:.1 },
        { transform:'rotate(-15deg) scaleX(1)', offset:.35 }, { transform:'rotate(-15deg) scaleX(1)' },
      ], timing));
    }
    // This authored intermediate is + 0, not a product of 2x and 0.
    const zero = document.createElement('span'); zero.className = 'math-emphasis'; zero.textContent = cancellation.intermediate;
    zero.setAttribute('aria-hidden', 'true'); cancelledGroup.append(zero);
    const measured = zero.getBoundingClientRect(); zero.remove(); zero.classList.add('math-zero-phase');
    Object.assign(zero.style, { left:`${bounds.left + (bounds.width - measured.width) / 2 - parent.left}px`, top:`${bounds.top - parent.top}px`,
      width:`${measured.width}px`, height:`${measured.height}px`, lineHeight:`${measured.height}px` });
    container.append(zero); extras.push(zero);
    animations.push(cancelledGroup.animate([{ opacity:1 }, { opacity:1, offset:.35 }, { opacity:0, offset:.5 }, { opacity:0 }], timing));
    animations.push(zero.animate([{ opacity:0 }, { opacity:0, offset:.45 }, { opacity:1, offset:.55 },
      { opacity:1, offset:.7 }, { opacity:0, offset:.78 }, { opacity:0 }], timing));
  }
  return track(animations, extras, speed);
}

export function animateEntry(container: HTMLElement, speed = 1): MathAnimation {
  const animation = container.animate([
    { color:getComputedStyle(container.closest('#math-viewer')!).color, backgroundColor:'transparent', boxShadow:'inset 0 -2px transparent' },
    paint(container),
  ], { duration:450, easing:'ease-out', fill:'both' });
  return track([animation], [], speed);
}
