import { mathExamples, type MathPart, type MathStep } from './examples';
import { getThemePreset } from 'code-loupe/themes';
import { animateEntry, animateMathTransition } from './replacement';

const viewer = document.querySelector<HTMLElement>('#math-viewer')!;
const picker = document.querySelector<HTMLSelectElement>('#math-example')!;
const current = viewer.querySelector<HTMLElement>('#math-current')!;
const variables = viewer.querySelector<HTMLElement>('#math-variables')!;
const caption = viewer.querySelector<HTMLElement>('#math-caption')!;
const counter = viewer.querySelector<HTMLElement>('#math-counter')!;
const announcement = viewer.querySelector<HTMLElement>('#math-announcement')!;
const back = viewer.querySelector<HTMLButtonElement>('[data-back]')!;
const next = viewer.querySelector<HTMLButtonElement>('[data-next]')!;
const restart = viewer.querySelector<HTMLButtonElement>('[data-restart]')!;
const fullscreen = viewer.querySelector<HTMLButtonElement>('[data-fullscreen]')!;
const scrub = viewer.querySelector<HTMLInputElement>('#math-scrub')!;
const motion = viewer.querySelector<HTMLButtonElement>('[data-motion]')!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let example = mathExamples[0], index = -1, revision = 0;
let motionChoice: boolean | undefined;
try { const choice = localStorage.getItem('code-loupe:motion'); motionChoice = choice === 'full' ? true : choice === 'reduced' ? false : undefined; } catch { /* Viewer controls still work without storage. */ }
const animationsOn = () => motionChoice ?? !reducedMotion.matches;
const play = viewer.querySelector<HTMLButtonElement>('[data-play]')!;
const speedPicker = viewer.querySelector<HTMLSelectElement>('#math-speed')!;
let playing = false, speed = 1, timer: ReturnType<typeof setTimeout> | undefined;
let active: ReturnType<typeof animateMathTransition> | undefined;

function syncPalette() {
  const theme = getThemePreset(document.documentElement.dataset.lessonTheme ?? 'midnight') ?? getThemePreset('midnight')!;
  for (const [key, value] of Object.entries(theme.palette)) viewer.style.setProperty(`--math-${key}`, value);
  if (active) settle();
}
function renderVariables(step: MathStep) {
  const rows = (step.variables ?? example.variables ?? []).map(variable => {
    const row = document.createElement('div'); row.className = 'math-variable';
    const name = document.createElement('span'); name.className = 'math-name'; name.textContent = variable.name;
    const eq = document.createElement('span'); eq.textContent = '=';
    const value = document.createElement('span'); value.className = 'math-value'; value.textContent = variable.value === 'unknown' ? '?' : String(variable.value);
    const tag = document.createElement('span'); tag.className = 'math-tag'; tag.textContent = variable.value === 'unknown' ? 'unknown' : 'solved';
    row.setAttribute('aria-label', `${variable.name}: ${variable.value === 'unknown' ? 'unknown' : variable.value}`);
    row.append(name, eq, value, tag); return row;
  });
  variables.replaceChildren(...rows);
}
function syncPlay() {
  const label = playing ? 'Pause' : 'Play';
  play.setAttribute('aria-label', label);
  play.querySelector('path')!.setAttribute('d', playing ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M7 4v16l13-8z');
}
function pause() { playing = false; clearTimeout(timer); timer = undefined; syncPlay(); }
function schedule() {
  clearTimeout(timer); timer = undefined;
  if (!playing) return;
  if (index === example.steps.length - 1) { pause(); return; }
  timer = setTimeout(() => { timer = undefined; move(index + 1, true, true); }, 1600 / speed);
}
function finishStep() { render(); schedule(); }
function togglePlay() {
  if (playing) { pause(); return; }
  if (index === example.steps.length - 1) move(-1, false);
  playing = true; syncPlay();
  if (!active) schedule();
}
function partNode(part: MathPart, emphasize: boolean): HTMLElement {
  const span = document.createElement('span');
  span.className = 'math-part';
  if (part.parts) { span.classList.add('math-part-group'); part.parts.forEach(child => span.append(partNode(child, emphasize))); }
  else span.textContent = part.text;
  if (emphasize && part.emphasis) span.classList.add('math-emphasis');
  if (part.id) span.dataset.part = part.id;
  return span;
}
function side(parts: MathPart[], emphasize: boolean) {
  const container = document.createElement('span'); container.className = 'math-side';
  parts.forEach(part => container.append(partNode(part, emphasize)));
  return container;
}
function expression(container: HTMLElement, step: MathStep, emphasize: boolean) {
  container.setAttribute('aria-label', step.spoken);
  container.dataset.equation = String(!!step.right);
  const left = side(step.left, emphasize);
  if (step.anchorTo !== undefined) {
    // Keep the starting expression's left edge, without padding individual terms.
    const reference = side(example.steps[step.anchorTo].left, false);
    Object.assign(reference.style, { position:'absolute', visibility:'hidden', width:'max-content' });
    container.append(reference);
    left.style.width = `${reference.getBoundingClientRect().width}px`;
    left.style.textAlign = 'left';
    reference.remove();
  }
  const content = [left];
  if (step.right) {
    const equals = document.createElement('span');
    equals.className = 'math-equals'; equals.textContent = '=';
    content.push(equals, side(step.right, emphasize));
  }
  for (const element of content) element.setAttribute('aria-hidden', 'true');
  container.replaceChildren(...content);
}
function render(announce = true, displayedStep = example.steps[index] ?? example.steps[0]) {
  const step = example.steps[index];
  viewer.querySelector<HTMLElement>('#math-title')!.textContent = example.title;
  document.querySelector<HTMLElement>('#math-objective')!.textContent = example.objective;
  current.hidden = !displayedStep;
  if (displayedStep) expression(current, displayedStep, index >= 0);
  else { current.replaceChildren(); current.setAttribute('aria-label', 'No expression yet'); }
  renderVariables(index < 0 ? { left:[], spoken:'', caption:'', variables:[] } : displayedStep);
  syncPlay();
  caption.textContent = step?.caption ?? '';
  counter.textContent = `Step ${index + 1} of ${example.steps.length}`;
  scrub.max = String(example.steps.length);
  scrub.value = String(index + 1);
  scrub.disabled = false;
  scrub.setAttribute('aria-valuetext', counter.textContent);
  back.disabled = index < 0;
  next.disabled = index === example.steps.length - 1;
  restart.disabled = index < 0;
  if (announce) announcement.textContent = `${example.title}. ${counter.textContent}. ${step ? `${step.spoken}. ${step.caption}` : 'Ready to begin.'}`;
}
function stopAnimation() {
  revision++;
  active?.cancel(); active = undefined;
  viewer.dataset.animating = 'false';
  viewer.setAttribute('aria-busy', 'false');
}
function settle() {
  if (!active) return;
  stopAnimation(); finishStep();
}
function syncMotion() {
  const enabled = animationsOn();
  motion.setAttribute('aria-pressed', String(enabled));
  motion.disabled = false;
  motion.title = enabled ? 'Animations on (click to turn off)' : 'Animations off (click to turn on)';
}
function move(to: number, animate = true, automatic = false) {
  if (!automatic) pause();
  const destination = Math.max(-1, Math.min(example.steps.length - 1, to));
  if (destination === index && !active) return;
  const forward = destination === index + 1;
  const sourceStep = example.steps[index];
  stopAnimation(); index = destination;
  const target = example.steps[index], transition = target?.transition;
  if (animate && forward && transition && sourceStep && animationsOn()) {
    render(false, sourceStep);
    const preview = current.cloneNode(false) as HTMLElement;
    preview.removeAttribute('id'); preview.setAttribute('aria-hidden', 'true');
    Object.assign(preview.style, { position:'absolute', inset:'0', visibility:'hidden', pointerEvents:'none' });
    current.append(preview); expression(preview, target, true);
    active = animateMathTransition(current, preview, transition, speed);
    preview.remove();
    viewer.dataset.animating = 'true'; viewer.setAttribute('aria-busy', 'true'); next.disabled = true;
    const generation = revision;
    void active.finished.then(() => {
      if (generation !== revision) return;
      const completed = active; active = undefined; viewer.dataset.animating = 'false'; viewer.setAttribute('aria-busy', 'false');
      finishStep(); completed?.cancel();
    });
    return;
  }
  if (animate && forward && !sourceStep && target && animationsOn()) {
    render(false); viewer.dataset.animating = 'true'; viewer.setAttribute('aria-busy', 'true'); next.disabled = true;
    active = animateEntry(current.querySelector<HTMLElement>('.math-emphasis') ?? current, speed);
    const generation = revision;
    void active.finished.then(() => {
      if (generation !== revision) return;
      const completed = active; active = undefined; viewer.dataset.animating = 'false'; viewer.setAttribute('aria-busy', 'false');
      finishStep(); completed?.cancel();
    });
    return;
  }
  finishStep();
}
back.addEventListener('click', () => move(index - 1));
next.addEventListener('click', () => move(index + 1));
restart.addEventListener('click', () => move(-1, false));
play.addEventListener('click', togglePlay);
speedPicker.addEventListener('change', () => { speed = Number(speedPicker.value); active?.setSpeed(speed); if (!active) schedule(); });
scrub.addEventListener('input', () => move(Number(scrub.value) - 1, false));
motion.addEventListener('click', () => { motionChoice = !animationsOn(); try { localStorage.setItem('code-loupe:motion', motionChoice ? 'full' : 'reduced'); } catch { /* Keep the in-page choice. */ } settle(); syncMotion(); });
reducedMotion.addEventListener('change', () => { settle(); syncMotion(); });
window.addEventListener('resize', () => { if (active) settle(); else render(false); });
picker.addEventListener('change', () => {
  const selected = mathExamples.find(item => item.id === picker.value);
  if (!selected) return;
  pause(); stopAnimation(); example = selected; index = -1; render();
});
viewer.addEventListener('keydown', event => {
  if ((event.target as Element).closest('input, select, textarea')) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.code === 'Space' && event.target === viewer) { event.preventDefault(); togglePlay(); return; }
  const destinations: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: -1, End: example.steps.length - 1 };
  if (!(event.key in destinations)) return;
  event.preventDefault(); move(destinations[event.key]);
});
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement === viewer) await document.exitFullscreen();
    else await viewer.requestFullscreen();
  } catch {
    announcement.textContent = 'Fullscreen is unavailable in this browser or embedding context.';
  }
});
document.addEventListener('fullscreenchange', () => {
  settle();
  const label = document.fullscreenElement === viewer ? 'Exit fullscreen' : 'Fullscreen';
  fullscreen.setAttribute('aria-label', label); fullscreen.title = label;
  fullscreen.setAttribute('aria-pressed', String(document.fullscreenElement === viewer));
});
syncPalette();
new MutationObserver(syncPalette).observe(document.documentElement, { attributes:true, attributeFilter:['data-lesson-theme'] });
render(false); syncMotion();
play.disabled = false; speedPicker.disabled = false;
viewer.dataset.animating = 'false';
picker.disabled = false;
viewer.dataset.ready = 'true';
