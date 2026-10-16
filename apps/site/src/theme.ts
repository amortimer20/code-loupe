import { getThemePreset } from 'code-loupe/themes';

const root = document.documentElement;
const appearance = document.querySelector<HTMLSelectElement>('#site-appearance')!;
const picker = document.querySelector<HTMLSelectElement>('#site-theme')!;

function syncPlayers() {
  document.querySelectorAll('code-loupe, math-loupe').forEach(player => {
    player.setAttribute('theme', root.dataset.lessonTheme ?? 'midnight');
  });
}

appearance.value = root.dataset.theme ?? 'light';
appearance.addEventListener('change', () => {
  if (!['light', 'dark'].includes(appearance.value)) return;
  root.dataset.theme = appearance.value;
  try { localStorage.setItem('code-loupe:site-theme', appearance.value); } catch { /* Keep the page usable without storage. */ }
});

picker.value = root.dataset.lessonTheme ?? 'midnight';
try { localStorage.setItem('code-loupe:lesson-theme', picker.value); } catch { /* Preserve migrated choices when storage allows it. */ }
syncPlayers();
picker.addEventListener('change', () => {
  if (!getThemePreset(picker.value)) return;
  root.dataset.lessonTheme = picker.value;
  try { localStorage.setItem('code-loupe:lesson-theme', picker.value); } catch { /* The current page still changes. */ }
  syncPlayers();
});

// The playground creates its player after fetching a draft. Apply the choice to
// newly added players too, without coupling theme selection to lesson editing.
new MutationObserver(syncPlayers).observe(document.body, { childList: true, subtree: true });
