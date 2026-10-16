import { binary, equation, group, minus, num, plus, sum, term, times, variable, type MathLesson } from './expression';

/** Prototype fixtures, not a public format. Ids name what a teacher would point at. */
export const orderOfOperations: MathLesson = {
  id: 'order', title: 'Multiplication before addition',
  objective: 'Follow the order of operations, one calculation at a time.',
  start: sum('sum', plus(num('three', 3)), plus(binary('product', num('two', 2), '×', num('four', 4)))),
  steps: [
    { focus: ['product'], caption: 'Multiply before adding. First focus on two times four.' },
    { changes: [{ kind: 'evaluate', target: 'product', result: num('eight', 8) }], caption: 'Two groups of four give eight. The addition remains.' },
    { focus: ['sum'], caption: 'Now only the addition is left.' },
    { changes: [{ kind: 'evaluate', target: 'sum', result: num('eleven', 11) }], caption: 'Three plus eight is eleven.' },
  ],
};

// The same numbers as the first example; only the grouping differs.
export const parenthesesFirst: MathLesson = {
  id: 'grouping', title: 'Parentheses change the grouping',
  objective: 'Compare this grouping with the first example: the same numbers give a different result.',
  start: binary('product', group('grouped', sum('sum', plus(num('three', 3)), plus(num('two', 2)))), '×', num('four', 4)),
  steps: [
    { focus: ['sum'], caption: 'Parentheses come first. Evaluate the sum inside them before multiplying.' },
    // Evaluating the whole group removes the parentheses with the sum they enclosed.
    { changes: [{ kind: 'evaluate', target: 'grouped', result: num('five', 5) }], caption: 'Three plus two is five. The parentheses have done their job.' },
    { focus: ['product'], caption: 'Now multiply that result by four.' },
    { changes: [{ kind: 'evaluate', target: 'product', result: num('twenty', 20) }], caption: 'Five groups of four give twenty. Grouping changed the order and the result.' },
  ],
};

// Each side is a sum, so a term can be added to or removed from either side.
// Both sides change in the same step whenever an operation keeps them equal.
export const balanceEquation: MathLesson = {
  id: 'equation', title: 'Keep both sides equal',
  objective: 'Solve a linear equation by applying the same operation to both sides.',
  start: equation('equation',
    sum('left', plus(times('two-x', num('coefficient', 2), variable('x', 'x'))), plus(num('three', 3))),
    sum('right', plus(num('eleven', 11)))),
  steps: [
    { focus: ['t-three'], caption: 'First undo the addition of three. We will subtract three from both sides.' },
    { changes: [
      { kind: 'append', target: 'left', term: minus(num('three-left', 3)) },
      { kind: 'append', target: 'right', term: minus(num('three-right', 3)) },
    ], caption: 'Subtract three from each side to preserve equality.' },
    { changes: [
      { kind: 'evaluate', target: ['t-three', 't-three-left'], result: term('t-zero', '+', num('zero', 0)) },
      { kind: 'evaluate', target: ['t-eleven', 't-three-right'], result: plus(num('eight', 8)) },
    ], caption: 'Plus three and minus three are opposites, so together they make zero. On the right, eleven minus three is eight.' },
    { changes: [{ kind: 'remove', target: 't-zero' }], focus: ['left', 'right'], caption: 'Adding zero changes nothing, so it can go. Two x equals eight.' },
    { changes: [
      { kind: 'wrap', target: 'left', id: 'left-division', op: '÷', operand: num('two-left', 2) },
      { kind: 'wrap', target: 'right', id: 'right-division', op: '÷', operand: num('two-right', 2) },
    ], caption: 'Divide each side by two to isolate x. Applying the same division preserves equality.' },
    // x keeps its identity through the division, so it slides into place rather than reappearing.
    { changes: [
      { kind: 'evaluate', target: 'left-division', result: variable('x', 'x') },
      { kind: 'evaluate', target: 'right-division', result: num('four', 4) },
    ], caption: 'Two x divided by two is x, and eight divided by two is four.' },
  ],
};

export const mathLessons = [orderOfOperations, parenthesesFirst, balanceEquation];
