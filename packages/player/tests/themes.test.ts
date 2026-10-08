import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeToHtml } from 'shiki';
import { themePresets } from '../src/themes';

function rgb(hex: string) {
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);
}
function luminance(rgb: number[]) {
  const [r, g, b] = rgb.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(fg: string, bg: number[]) {
  const a = luminance(rgb(fg)), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('starter text and syntax stay readable on their surfaces and active lines', () => {
  for (const theme of themePresets) {
    const p = theme.palette;
    const active = rgb(p.bg).map((c, i) => c * 0.86 + rgb(p.accent)[i] * 0.14);
    const surfaces = [rgb(p.bg), rgb(p.panel), rgb(p.raised), active];
    const colors = { fg: p.fg, muted: p.muted, accent: p.accent, error: p.error, name: p.name, input: p.input, ...theme.syntax };
    for (const [token, color] of Object.entries(colors)) {
      for (const surface of surfaces) {
        assert.ok(ratio(color, surface) >= 4.5, `${theme.id} ${token}: ${ratio(color, surface).toFixed(2)}:1`);
      }
    }
    assert.ok(ratio(p.onAccent, rgb(p.accent)) >= 4.5, `${theme.id} button text`);
  }
});

test('starter themes highlight Python, JavaScript, and badge literals with the same palette', async () => {
  for (const theme of themePresets) {
    for (const [lang, source] of [['python', '# note\ndef bump(value):\n    return value + 11'], ['javascript', '// note\nfunction bump(value) { return value + 11; }']]) {
      const html = await codeToHtml(source, { lang, theme: theme.highlight });
      for (const color of [theme.palette.bg, theme.syntax.keyword, theme.syntax.function, theme.syntax.comment, theme.syntax.number]) {
        assert.ok(html.toLowerCase().includes(color.toLowerCase()), `${theme.id} ${lang} missing ${color}`);
      }
    }
    const literal = await codeToHtml('11', { lang: 'python', theme: theme.highlight, structure: 'inline' });
    assert.ok(literal.toLowerCase().includes(theme.syntax.number.toLowerCase()));
  }
});
