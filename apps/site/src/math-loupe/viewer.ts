import { mathLessons } from './examples';
import { MathLoupe } from './math-loupe';

// Page glue: the example picker chooses which lesson the player shows.
const player = document.querySelector<MathLoupe>('math-loupe')!;
const picker = document.querySelector<HTMLSelectElement>('#ml-example')!;
const objective = document.querySelector<HTMLElement>('#ml-objective')!;

function load(id: string) {
  const lesson = mathLessons.find(item => item.id === id);
  if (!lesson) return;
  player.lesson = lesson;
  player.removeAttribute('aria-label');
  objective.textContent = lesson.objective;
}

picker.addEventListener('change', () => load(picker.value));
load(picker.value);
picker.disabled = false;
player.dataset.ready = 'true';
