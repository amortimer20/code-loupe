import { codeToHtml, bundledThemes, type BundledTheme, type ThemeRegistration } from 'shiki';
import type { Lesson } from './lesson';
import type { Snapshot } from './state';
import { getThemePreset } from './themes';
import { formatValue, isReference } from './values';

/** Highlight every value that can appear so badges and variables match the code's colors. */
export async function highlightLiterals(lesson: Lesson, snapshots: Snapshot[], theme: string | ThemeRegistration) {
  const texts = new Set<string>();
  for (const snap of snapshots) {
    for (const v of [...snap.vars, ...snap.frames.flatMap(f => f.vars), ...snap.badges]) {
      if (isReference(v.value)) continue;
      texts.add(formatValue(v.value, lesson.language, v.type));
      if (Array.isArray(v.value)) for (const item of v.value) texts.add(formatValue(item, lesson.language));
    }
    for (const object of snap.heap) {
      if ('fields' in object) {
        for (const item of Object.values(object.fields)) texts.add(formatValue(item, lesson.language));
      } else {
        texts.add(formatValue(object.value, lesson.language, object.type));
        for (const item of object.value) texts.add(formatValue(item, lesson.language));
      }
    }
    const from = snap.events.converted?.from;
    if (from && !isReference(from.value)) texts.add(formatValue(from.value, lesson.language, from.type));
  }
  const entries = await Promise.all(
    [...texts].map(async (text) => [text, await codeToHtml(text, { lang: lesson.language, theme, structure: 'inline' })] as const),
  );
  return new Map(entries);
}

/**
 * Highlight the lesson's code and every literal in the theme named by `currentTheme()`.
 * A theme can change while highlighting is under way, so the name is read again afterwards
 * and the work repeats until it finishes with the latest choice. A failure only counts if its
 * theme is still current; that lets a change away from a bad theme recover on its own.
 */
export async function highlightLesson(lesson: Lesson, snapshots: Snapshot[], currentTheme: () => string) {
  while (true) {
    const name = currentTheme();
    const preset = getThemePreset(name);
    try {
      const theme = preset?.highlight ?? (await bundledThemes[name as BundledTheme]?.())?.default ?? name;
      const [codeHtml, literals] = await Promise.all([
        codeToHtml(lesson.code, { lang: lesson.language, theme }),
        highlightLiterals(lesson, snapshots, theme),
      ]);
      if (name === currentTheme()) {
        return { codeHtml, literals, preset, variant: typeof theme === 'string' ? undefined : theme.type };
      }
    } catch (error) {
      if (name === currentTheme()) throw error;
    }
  }
}
