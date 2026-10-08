import { getThemePreset } from 'code-loupe/themes';

const root = document.documentElement;
const picker = document.querySelector<HTMLSelectElement>('#site-theme')!;

function syncPlayers() {
  document.querySelectorAll('code-loupe').forEach(player => {
    player.setAttribute('theme', root.dataset.theme ?? 'midnight');
  });
}

picker.value = root.dataset.theme ?? 'midnight';
syncPlayers();
picker.addEventListener('change', () => {
  if (!getThemePreset(picker.value)) return;
  root.dataset.theme = picker.value;
  try { localStorage.setItem('code-loupe:site-theme', picker.value); } catch { /* The current page still changes. */ }
  syncPlayers();
});

// The playground creates its player after fetching a draft. Apply the choice to
// newly added players too, without coupling theme selection to lesson editing.
new MutationObserver(syncPlayers).observe(document.body, { childList: true, subtree: true });
