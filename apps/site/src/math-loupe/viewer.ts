import { getThemePreset } from 'code-loupe/themes';
import { buildMathSnapshots, type MathLesson } from './expression';
import { mathLessons } from './examples';
import { MathStage } from './stage';

// Minimal stepping shell for reviewing the new core. Autoplay, speed, scrubbing and
// fullscreen return when this replaces the /math/ prototype.
const viewer = document.querySelector<HTMLElement>('#ml-viewer')!;
const picker = document.querySelector<HTMLSelectElement>('#ml-example')!;
const objective = document.querySelector<HTMLElement>('#ml-objective')!;
const title = viewer.querySelector<HTMLElement>('#ml-title')!;
const host = viewer.querySelector<HTMLElement>('.ml-stage')!;
const caption = viewer.querySelector<HTMLElement>('.ml-caption')!;
const counter = viewer.querySelector<HTMLElement>('.ml-counter')!;
const announcement = viewer.querySelector<HTMLElement>('.ml-announcement')!;
const back = viewer.querySelector<HTMLButtonElement>('[data-back]')!;
const next = viewer.querySelector<HTMLButtonElement>('[data-next]')!;
const restart = viewer.querySelector<HTMLButtonElement>('[data-restart]')!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let lesson = mathLessons[0], snapshots = buildMathSnapshots(lesson), last = snapshots.length - 1;
let stage = new MathStage(host, snapshots);
let index = 0;

function animationsOn() {
  try {
    const choice = localStorage.getItem('code-loupe:motion');
    if (choice === 'full' || choice === 'reduced') return choice === 'full';
  } catch { /* Fall back to the system preference. */ }
  return !reducedMotion.matches;
}
function sync(announce = true) {
  const snapshot = snapshots[index];
  title.textContent = lesson.title;
  objective.textContent = lesson.objective;
  host.setAttribute('aria-label', snapshot.spoken);
  caption.textContent = snapshot.caption;
  counter.textContent = `Step ${index} of ${last}`;
  back.disabled = restart.disabled = index === 0;
  next.disabled = index === last;
  if (announce) announcement.textContent = `${counter.textContent}. ${snapshot.spoken}. ${snapshot.caption}`;
}
function go(to: number) {
  const destination = Math.max(0, Math.min(last, to));
  if (destination === index && !stage.animating) return;
  const forward = destination === index + 1;
  index = destination; sync();
  viewer.dataset.animating = String(forward && animationsOn());
  const current = stage;
  void current.show(index, forward && animationsOn()).then(() => { if (current === stage && !stage.animating) viewer.dataset.animating = 'false'; });
}
function load(selected: MathLesson) {
  stage.settle();
  lesson = selected; snapshots = buildMathSnapshots(lesson); last = snapshots.length - 1; index = 0;
  stage = new MathStage(host, snapshots);
  viewer.dataset.animating = 'false';
  sync(false);
}
function syncPalette() {
  const theme = getThemePreset(document.documentElement.dataset.lessonTheme ?? 'midnight') ?? getThemePreset('midnight')!;
  for (const [key, value] of Object.entries(theme.palette)) viewer.style.setProperty(`--ml-${key}`, value);
  stage.settle();
}

back.addEventListener('click', () => go(index - 1));
next.addEventListener('click', () => go(index + 1));
restart.addEventListener('click', () => go(0));
picker.addEventListener('change', () => {
  const selected = mathLessons.find(item => item.id === picker.value);
  if (selected) load(selected);
});
viewer.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const destinations: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: last };
  if (!(event.key in destinations)) return;
  event.preventDefault(); go(destinations[event.key]);
});
reducedMotion.addEventListener('change', () => stage.settle());
new ResizeObserver(() => stage.relayout()).observe(host);
void document.fonts.ready.then(() => stage.relayout());
new MutationObserver(syncPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lesson-theme'] });
syncPalette(); sync(false);
picker.disabled = false;
viewer.dataset.ready = 'true';
