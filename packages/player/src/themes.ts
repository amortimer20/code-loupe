import type { ThemeRegistration } from 'shiki';

// The starter presets coordinate the site and player. These are deliberately
// small internal palettes; a general host-provided theme API can come later.
interface Palette {
  bg: string;
  panel: string;
  raised: string;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  onAccent: string;
  error: string;
  name: string;
  input: string;
}
interface Syntax {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  function: string;
  type: string;
  operator: string;
}
export interface ThemePreset {
  id: string;
  label: string;
  variant: 'light' | 'dark';
  palette: Palette;
  syntax: Syntax;
  highlight: ThemeRegistration;
}

function preset(id: string, label: string, variant: 'light' | 'dark', palette: Palette, syntax: Syntax): ThemePreset {
  return {
    id, label, variant, palette, syntax,
    highlight: {
      name: `code-loupe-${id}`, type: variant,
      colors: { 'editor.background': palette.bg, 'editor.foreground': palette.fg },
      tokenColors: [
        { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: syntax.comment } },
        { scope: ['string'], settings: { foreground: syntax.string } },
        { scope: ['constant.numeric', 'constant.language', 'support.constant'], settings: { foreground: syntax.number } },
        { scope: ['keyword', 'storage'], settings: { foreground: syntax.keyword } },
        { scope: ['keyword.operator'], settings: { foreground: syntax.operator } },
        { scope: ['entity.name.function', 'support.function'], settings: { foreground: syntax.function } },
        { scope: ['entity.name.type', 'support.type', 'support.class'], settings: { foreground: syntax.type } },
      ],
    },
  };
}

export const themePresets: readonly ThemePreset[] = [
  preset('paper', 'Paper', 'light', {
    bg: '#faf7ef', panel: '#f0ede4', raised: '#e8e4da', fg: '#292720', muted: '#625f56',
    border: '#c9c4b8', accent: '#256c61', onAccent: '#ffffff', error: '#ad332b',
    name: '#245b88', input: '#785a15',
  }, {
    keyword: '#695095', string: '#24675a', number: '#85520d', comment: '#625f56',
    function: '#9a421b', type: '#245b88', operator: '#945141',
  }),
  preset('midnight', 'Midnight', 'dark', {
    bg: '#191d2d', panel: '#141724', raised: '#242a3d', fg: '#cbd5f3', muted: '#9ba8ca',
    border: '#424d69', accent: '#90b4fa', onAccent: '#141724', error: '#ff99ad',
    name: '#91d6ee', input: '#eac584',
  }, {
    keyword: '#c3a6f5', string: '#b2d88b', number: '#f3b27a', comment: '#9ba8ca',
    function: '#90b4fa', type: '#91d6ee', operator: '#a1dce9',
  }),
  preset('terminal', 'Terminal', 'dark', {
    bg: '#101815', panel: '#0c120f', raised: '#1c2b23', fg: '#d4e7d8', muted: '#9fb9a7',
    border: '#425e4b', accent: '#8ad6a1', onAccent: '#101815', error: '#ff9b95',
    name: '#8ad6a1', input: '#e5c07b',
  }, {
    keyword: '#8ad6a1', string: '#bad78e', number: '#e5c07b', comment: '#9fb9a7',
    function: '#91d8ce', type: '#b5c8ec', operator: '#d4e7d8',
  }),
];

export function getThemePreset(id: string): ThemePreset | undefined {
  return themePresets.find(theme => theme.id === id);
}
