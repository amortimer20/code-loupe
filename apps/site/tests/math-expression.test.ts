import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMathSnapshots, evaluationPairs, num, plus, sum, tokens, type MathLesson, type MathLessonStep } from '../src/math-loupe/expression';
import { balanceEquation, mathLessons, orderOfOperations, parenthesesFirst } from '../src/math-loupe/examples';

const text = (lesson: MathLesson) => buildMathSnapshots(lesson).map(snapshot => tokens(snapshot.expression).map(token => token.text).join(' '));
const ids = (lesson: MathLesson, index: number) => tokens(buildMathSnapshots(lesson)[index].expression).map(token => token.id);

test('evaluation replaces one subtree and keeps every other glyph identity', () => {
  const snapshots = buildMathSnapshots(orderOfOperations);
  assert.deepEqual(text(orderOfOperations), ['3 + 2 × 4', '3 + 2 × 4', '3 + 8', '3 + 8', '11']);
  assert.deepEqual(ids(orderOfOperations, 2), ['three', 't-product/sign', 'eight']);
  assert.deepEqual(snapshots.map(snapshot => snapshot.focus), [[], ['product'], ['eight'], ['sum'], ['eleven']]);
  assert.deepEqual(snapshots.map(snapshot => snapshot.spoken), ['3 plus 2 times 4', '3 plus 2 times 4', '3 plus 8', '3 plus 8', '11']);
  assert.equal(snapshots[0].caption, '');
  // Earlier snapshots are untouched, so stepping backward is a lookup.
  assert.equal(tokens(snapshots[1].expression).length, 5);
});

test('parentheses are explicit groups that leave with the sum they enclose', () => {
  const snapshots = buildMathSnapshots(parenthesesFirst);
  assert.deepEqual(text(parenthesesFirst), ['( 3 + 2 ) × 4', '( 3 + 2 ) × 4', '5 × 4', '5 × 4', '20']);
  assert.deepEqual(ids(parenthesesFirst, 0), ['grouped/(', 'three', 't-two/sign', 'two', 'grouped/)', 'product/op', 'four']);
  // The multiplication keeps its identity, so "× 4" can slide rather than reappear.
  assert.deepEqual(ids(parenthesesFirst, 2), ['five', 'product/op', 'four']);
  assert.deepEqual(snapshots.map(snapshot => snapshot.focus), [[], ['sum'], ['five'], ['product'], ['twenty']]);
  assert.equal(snapshots[0].spoken, 'open parenthesis 3 plus 2 close parenthesis times 4');
});

test('the equation changes both sides together and keeps its equals sign', () => {
  const snapshots = buildMathSnapshots(balanceEquation);
  assert.deepEqual(text(balanceEquation).map(line => line.replace(' ⁢ ', '')), [
    '2x + 3 = 11', '2x + 3 = 11', '2x + 3 − 3 = 11 − 3', '2x + 0 = 8', '2x = 8', '2x ÷ 2 = 8 ÷ 2', 'x = 4']);
  for (let index = 0; index < snapshots.length; index++) assert.ok(ids(balanceEquation, index).includes('equation/='));
  assert.deepEqual(snapshots.map(snapshot => snapshot.focus), [[], ['t-three'], ['t-three-left', 't-three-right'],
    ['t-zero', 't-eight'], ['left', 'right'], ['left-division', 'right-division'], ['x', 'four']]);
  assert.deepEqual(snapshots.map(snapshot => snapshot.spoken), ['2 x plus 3 equals 11', '2 x plus 3 equals 11',
    '2 x plus 3 minus 3 equals 11 minus 3', '2 x plus 0 equals 8', '2 x equals 8', '2 x divided by 2 equals 8 divided by 2', 'x equals 4']);
  // Opposite terms combine as a pair, and each side's glyphs drift to that side's result.
  assert.deepEqual(evaluationPairs(snapshots[2].expression, snapshots[3].expression, snapshots[3].changes), [
    { sources: ['t-three/sign', 'three', 't-three-left/sign', 'three-left'], results: ['t-zero/sign', 'zero'] },
    { sources: ['eleven', 't-three-right/sign', 'three-right'], results: ['eight'] },
  ]);
  // Variables are authored: hidden at Step 0, unknown until the solving step, and never inferred.
  assert.deepEqual(snapshots.map(snapshot => snapshot.variables.map(item => `${item.name}=${item.value}`).join()),
    ['', 'x=unknown', 'x=unknown', 'x=unknown', 'x=unknown', 'x=unknown', 'x=4']);
  assert.throws(() => buildMathSnapshots({ ...balanceEquation, steps: [{ caption: '', variables: [{ name: 'y', value: 1 }] }] }), /variable "y" is not declared/);
  // x survives the division, so it is a retained glyph rather than a new one.
  assert.ok(ids(balanceEquation, 5).includes('x') && ids(balanceEquation, 6).includes('x'));
});

test('every example builds', () => {
  for (const lesson of mathLessons) assert.equal(buildMathSnapshots(lesson).length, lesson.steps.length + 1);
});

test('authoring mistakes name the step and the node', () => {
  const lesson = (...steps: MathLessonStep[]): MathLesson => ({ id: 'bad', title: '', objective: '', start: sum('sum', plus(num('a', 1)), plus(num('b', 2)), plus(num('c', 3))), steps });
  assert.throws(() => buildMathSnapshots(lesson({ caption: '', changes: [{ kind: 'evaluate', target: 'nope', result: num('d', 3) }] })), /step 1: cannot evaluate missing node "nope"/);
  assert.throws(() => buildMathSnapshots(lesson({ caption: '', changes: [{ kind: 'evaluate', target: 'a', result: num('b', 3) }] })), /new node id "b" is already in use/);
  assert.throws(() => buildMathSnapshots(lesson({ caption: '', changes: [{ kind: 'evaluate', target: ['t-a', 't-c'], result: plus(num('d', 4)) }] })), /adjacent terms/);
  assert.throws(() => buildMathSnapshots(lesson({ caption: '', changes: [{ kind: 'evaluate', target: ['t-a', 't-b'], result: num('d', 3) }] })), /must produce a term/);
  assert.throws(() => buildMathSnapshots(lesson({ caption: '', changes: [{ kind: 'append', target: 'a', term: plus(num('d', 4)) }] })), /append a term to a sum/);
  assert.throws(() => buildMathSnapshots(lesson({ caption: '', changes: [{ kind: 'remove', target: 'a' }] })), /remove a term of a sum/);
  assert.throws(() => buildMathSnapshots(lesson({ caption: '', focus: ['a'] }, { caption: '', changes: [{ kind: 'evaluate', target: 'sum', result: num('d', 6) }] }, { caption: '', focus: ['a'] })), /step 3: cannot focus missing node "a"/);
  assert.throws(() => buildMathSnapshots({ ...lesson(), start: sum('sum', plus(num('a', 1)), plus(num('a', 2))) }), /"t-a" is used more than once/);
});
