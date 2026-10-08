import { CodeLoupe } from './code-loupe';

export { CodeLoupe };
export { themePresets, getThemePreset } from './themes';
export { parseLesson, LessonError } from './lesson';
export type { Lesson, Step, Value, CallSpec, ReturnSpec } from './lesson';

if (!customElements.get('code-loupe')) {
  customElements.define('code-loupe', CodeLoupe);
}
