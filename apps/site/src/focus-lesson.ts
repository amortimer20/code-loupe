const view = document.querySelector<HTMLDialogElement>('#lesson-view')!;
const enter = document.querySelector<HTMLButtonElement>('#focus-lesson')!;
const exit = document.querySelector<HTMLButtonElement>('#exit-focus')!;
const bar = view.querySelector<HTMLElement>('.focus-bar')!;
const player = view.querySelector('code-loupe')!;
let focused = false;
let pageScroll = 0;

enter.addEventListener('click', () => {
  pageScroll = window.scrollY;
  // Reuse the inline dialog and player. Reparenting the component would reconnect
  // it and reload the lesson, losing the viewer's current step.
  view.close();
  focused = true;
  bar.hidden = false;
  player.setAttribute('fit', '');
  document.documentElement.classList.add('lesson-focused');
  view.showModal();
  exit.focus();
});

exit.addEventListener('click', () => view.close());
view.addEventListener('close', () => {
  // close() on entry queues an event too; by then the modal is open again.
  if (!focused || view.open) return;
  focused = false;
  bar.hidden = true;
  player.removeAttribute('fit');
  document.documentElement.classList.remove('lesson-focused');
  view.show();
  window.scrollTo({ top: pageScroll, behavior: 'instant' });
  enter.focus({ preventScroll: true });
});
