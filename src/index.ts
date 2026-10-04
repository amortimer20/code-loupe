import { CodeAnimator } from './code-animator';

export { CodeAnimator };
export { parseLesson, LessonError } from './lesson';
export type { Lesson, Step, Value } from './lesson';

if (!customElements.get('code-animator')) {
  customElements.define('code-animator', CodeAnimator);
}
