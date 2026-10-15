import type { ThemePreset } from '../themes';

const TOKENS = ['bg', 'fg', 'panel', 'raised', 'muted', 'line', 'accent', 'name', 'input', 'error'];

/**
 * Color the player with a starter preset's palette, or, for a regular Shiki theme, with the
 * background and text colors of its highlighted code.
 */
export function applyPalette(ca: HTMLElement, codeHost: HTMLElement, preset: ThemePreset | undefined, variant?: 'light' | 'dark') {
  // Clear every preset override when returning to a regular Shiki theme.
  for (const token of TOKENS) {
    ca.style.removeProperty(`--ca-${token}`);
  }
  if (preset) {
    const p = preset.palette;
    const tokens = { bg: p.bg, fg: p.fg, panel: p.panel, raised: p.raised, muted: p.muted,
      line: p.border, accent: p.accent, name: p.name, input: p.input, error: p.error };
    for (const [token, color] of Object.entries(tokens)) {
      ca.style.setProperty(`--ca-${token}`, color);
    }
    ca.style.colorScheme = preset.variant;
  } else {
    const pre = codeHost.querySelector('pre');
    if (pre?.style.backgroundColor) ca.style.setProperty('--ca-bg', pre.style.backgroundColor);
    if (pre?.style.color) ca.style.setProperty('--ca-fg', pre.style.color);
    ca.style.colorScheme = variant ?? 'normal';
  }
}
