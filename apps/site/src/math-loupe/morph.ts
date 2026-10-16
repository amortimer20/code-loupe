
/**
 * One general transition between two rendered snapshots. The final DOM is
 * installed before anything moves; persisting glyphs animate from their old
 * positions (FLIP), and only departing glyphs use temporary overlays. Cancelling
 * therefore always leaves the correct final state.
 */
export interface MathMorph { finished: Promise<void>; cancel(): void; setRate(rate: number): void }
interface Rect { x: number; y: number; width: number; height: number }
interface Glyph { element: Element; rect: Rect; color: string }

// Phases as fractions of one transition. Departing glyphs leave before results
// arrive, so old and new text never overlap at full strength.
const EXIT: [number, number] = [0, .45];
const MOVE: [number, number] = [.15, .75];
const ENTER: [number, number] = [.4, .85];
const EVALUATE_MS = 900, FOCUS_MS = 450;

function relative(element: Element, host: HTMLElement): Rect {
  const box = element.getBoundingClientRect(), origin = host.getBoundingClientRect();
  return { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height };
}
function glyphs(host: HTMLElement) {
  return new Map([...host.querySelectorAll('.ml-expression [data-token]')].map(element =>
    [(element as HTMLElement).dataset.token!, { element, rect: relative(element, host), color: getComputedStyle(element).color }] as [string, Glyph]));
}
function boxes(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>('.ml-focus-box')].map(box => relative(box, host));
}
function within([start, end]: [number, number], from: Keyframe, to: Keyframe): Keyframe[] {
  return [{ ...from, offset: 0 }, { ...from, offset: start, easing: 'ease-in-out' }, { ...to, offset: end }, { ...to, offset: 1 }];
}
const center = (rect: Rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
const place = (rect: Rect) => ({ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });

/** A detached copy of a departing glyph, aligned exactly over where it was. */
function ghost(host: HTMLElement, glyph: Glyph, overlays: Element[]) {
  const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
  math.classList.add('ml-ghost'); math.setAttribute('aria-hidden', 'true');
  const copy = glyph.element.cloneNode(true) as Element; copy.removeAttribute('data-token');
  math.append(copy); host.append(math); overlays.push(math);
  const landed = relative(copy, host), wrapper = relative(math, host);
  Object.assign((math as MathMLElement).style, { left: `${glyph.rect.x - landed.x + wrapper.x}px`, top: `${glyph.rect.y - landed.y + wrapper.y}px` });
  return math as MathMLElement;
}

/** Old glyphs that become new ones, from `evaluationPairs()`. */
export interface GlyphPair { sources: string[]; results: string[] }

/**
 * Glyph identity drives everything: glyphs in both snapshots move, glyphs only in
 * the old one fade out, and glyphs only in the new one fade in. Pairs say which
 * result a departing glyph drifts toward.
 */
export function morph(host: HTMLElement, pairs: GlyphPair[], changed: boolean, install: () => void, rate = 1): MathMorph {
  const before = glyphs(host), oldBoxes = boxes(host);
  install();
  const after = glyphs(host), newBoxes = boxes(host);
  const animations: Animation[] = [], overlays: Element[] = [];
  const timing: KeyframeAnimationOptions = { duration: changed ? EVALUATE_MS : FOCUS_MS, fill: 'both' };
  const move: [number, number] = changed ? MOVE : [0, 1];

  const destinations = new Map<string, { x: number; y: number }>();
  for (const pair of pairs) {
    const rects = pair.results.flatMap(id => after.get(id)?.rect ?? []);
    if (!rects.length) continue;
    const left = Math.min(...rects.map(r => r.x)), right = Math.max(...rects.map(r => r.x + r.width));
    for (const id of pair.sources) destinations.set(id, center({ x: left, y: rects[0].y, width: right - left, height: rects[0].height }));
  }

  for (const [id, glyph] of before) {
    const kept = after.get(id);
    if (kept) {
      const dx = glyph.rect.x - kept.rect.x, dy = glyph.rect.y - kept.rect.y;
      const from: Keyframe = { transform: `translate(${dx}px, ${dy}px)`, color: glyph.color }, to: Keyframe = { transform: 'none', color: kept.color };
      if (Math.abs(dx) > .5 || Math.abs(dy) > .5 || glyph.color !== kept.color) animations.push(kept.element.animate(within(move, from, to), timing));
      continue;
    }
    // Departing glyphs drift toward the result they become while fading out.
    const copy = ghost(host, glyph, overlays), origin = center(glyph.rect), destination = destinations.get(id);
    const drift = destination ? `translate(${(destination.x - origin.x) * .6}px, 0)` : 'none';
    animations.push(copy.animate(within(EXIT, { opacity: 1, transform: 'none' }, { opacity: 0, transform: drift }), timing));
  }
  for (const [id, glyph] of after) {
    if (before.has(id)) continue;
    animations.push(glyph.element.animate(within(changed ? ENTER : [0, 1], { opacity: 0 }, { opacity: 1 }), timing));
  }

  // Emphasis boxes reshape when there is a one-to-one correspondence; otherwise they cross-fade.
  const current = [...host.querySelectorAll<HTMLElement>('.ml-focus-box')];
  if (oldBoxes.length === newBoxes.length) {
    current.forEach((box, index) => animations.push(box.animate(within(move, place(oldBoxes[index]), place(newBoxes[index])), timing)));
  } else {
    for (const rect of oldBoxes) {
      const box = document.createElement('div'); box.className = 'ml-focus-box'; Object.assign(box.style, place(rect));
      host.querySelector('.ml-focus-layer')!.append(box); overlays.push(box);
      animations.push(box.animate(within(changed ? EXIT : [0, 1], { opacity: 1 }, { opacity: 0 }), timing));
    }
    current.forEach(box => animations.push(box.animate(within(changed ? ENTER : [0, 1], { opacity: 0 }, { opacity: 1 }), timing)));
  }

  animations.forEach(animation => { animation.playbackRate = rate; });
  return {
    finished: Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      animations.forEach(animation => animation.cancel()); overlays.forEach(overlay => overlay.remove());
    }),
    cancel() { animations.forEach(animation => animation.cancel()); overlays.forEach(overlay => overlay.remove()); },
    setRate(next) { animations.forEach(animation => animation.updatePlaybackRate(next)); },
  };
}
