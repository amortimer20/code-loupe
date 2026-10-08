const view = document.querySelector<HTMLDialogElement>('#lesson-view')!;
const toggle = view.querySelector<HTMLButtonElement>('.fullscreen-toggle')!;
const player = view.querySelector('code-loupe')!;
let focused = false;
let pageScroll = 0;

function updateToggle() {
  const label = focused ? 'Exit fullscreen' : 'Enter fullscreen';
  toggle.setAttribute('aria-label', label);
  toggle.setAttribute('aria-pressed', String(focused));
  toggle.title = focused ? `${label} (Esc)` : label;
}

toggle.addEventListener('click', () => {
  if (focused) return view.close();
  pageScroll = window.scrollY;
  // Keep the player connected so changing the view preserves the current step.
  view.close();
  focused = true;
  updateToggle();
  player.setAttribute('fit', '');
  document.documentElement.classList.add('lesson-focused');
  view.showModal();
  toggle.focus({ preventScroll: true });
});

view.addEventListener('close', () => {
  // Entry queues a close event too; by then the modal is open again.
  if (!focused || view.open) return;
  focused = false;
  updateToggle();
  player.removeAttribute('fit');
  document.documentElement.classList.remove('lesson-focused');
  view.show();
  window.scrollTo({ top: pageScroll, behavior: 'instant' });
  toggle.focus({ preventScroll: true });
});
