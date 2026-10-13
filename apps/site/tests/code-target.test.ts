import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expressionTarget } from '../src/authoring/code-target';

test('expression offsets identify repeated and overlapping targets exactly as the player does', () => {
  assert.deepEqual(expressionTarget('x = x + 1', 1, 4, 5), { line:1, over:'x', nth:2 });
  assert.deepEqual(expressionTarget('aaa', 1, 1, 3), { line:1, over:'aa', nth:2 });
  assert.deepEqual(expressionTarget('  print(2 + 3)', 1, 8, 13), { line:1, over:'2 + 3', nth:1 });
  assert.deepEqual(expressionTarget('a\n  x + x\n', 2, 1, 7), { line:2, over:'x + x', nth:1 });
  assert.deepEqual(expressionTarget('😀 + "a" + "a"', 1, 11, 14), { line:1, over:'"a"', nth:2 });
});

test('blank, invalid and out-of-line selections are rejected', () => {
  for (const [line, start, end] of [[0,0,1], [2,0,1], [1,-1,1], [1,2,1], [1,0,20], [1,0.5,2]]) {
    assert.throws(() => expressionTarget('x  ', line, start, end), /one code line/);
  }
  assert.throws(() => expressionTarget('x  ', 1, 1, 3), /whitespace/);
});
