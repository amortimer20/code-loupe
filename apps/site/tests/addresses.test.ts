import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressOf, isListAddress, isName } from '../src/authoring/addresses';

// The patterns the builder used before it shared the player's grammar. The shared predicates
// must agree with them on every input the builder can meet, including malformed ones.
const legacyName = (value: unknown) => typeof value === 'string' && /^[A-Za-z_]\w*$/.test(value);
const legacyList = (value: unknown) => typeof value === 'string' && /^[A-Za-z_]\w*\[\d+\]$/.test(value)
  && Number.isSafeInteger(Number(value.slice(value.indexOf('[') + 1, -1)));

const inputs: unknown[] = [
  'x', '_n', 'a1', 'A_b_9', '1a', '', ' ', 'x ', ' x', 'x\n', 'console', 'héllo', 'x-y',
  'x[0]', 'x[01]', 'x[10]', 'x[ 0]', 'x[0 ]', 'x[-1]', 'x[1.5]', 'x[]', 'x[0', 'x0]', 'x[0]\n', '[0]', '_[0]',
  'x[9007199254740991]', 'x[9007199254740993]', 'x[99999999999999999999]', 'x[٣]',
  'x["k"]', "x['k']", 'x.name', 'self.name', 'x[0][1]', 'x[0].y', 'x.y.z', 'x.1',
  5, null, undefined, {}, ['x'], true,
];

test('shared predicates agree with the legacy name and list-address patterns', () => {
  for (const input of inputs) {
    assert.equal(isName(input), legacyName(input), `name: ${JSON.stringify(input)}`);
    assert.equal(isListAddress(input), legacyList(input), `list address: ${JSON.stringify(input)}`);
  }
});

test('address parsing returns the player grammar shapes, or undefined', () => {
  assert.deepEqual(addressOf('numbers'), { var: 'numbers' });
  assert.deepEqual(addressOf('numbers[2]'), { var: 'numbers', index: 2 });
  assert.deepEqual(addressOf('report["score"]'), { var: 'report', key: 'score' });
  assert.deepEqual(addressOf('ada.name'), { var: 'ada', attribute: 'name' });
  for (const bad of ['', 'x[', 'x[0][1]', 'x y', 5, null]) assert.equal(addressOf(bad), undefined, String(bad));
});
