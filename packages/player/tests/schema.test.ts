import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import Ajv from 'ajv';
import { parse } from 'yaml';
import { parseLesson } from '../src/lesson';
import { buildSnapshots } from '../src/state';
import { parseAddress } from '../src/address';

const schema = JSON.parse(readFileSync(new URL('../lesson.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false, strictNumbers: true });
assert.equal(ajv.validateSchema(schema), true, ajv.errorsText());
const validate = ajv.compile(schema);
const lesson = (step: unknown) => ({ language: 'python', code: 'x', steps: [step] });
const check = (data: unknown, expected: boolean) => assert.equal(validate(data), expected, JSON.stringify(data) + '\n' + ajv.errorsText(validate.errors));

test('editor schema accepts every canonical lesson without normalizing away authored fields', () => {
  const directory = new URL('../../../lessons/python/', import.meta.url);
  const names = readdirSync(directory);
  assert.equal(names.length, 24);
  for (const name of names) {
    const source = readFileSync(new URL(name + '/lesson.yaml', directory), 'utf8');
    check(parse(source), true);
    assert.doesNotThrow(() => buildSnapshots(parseLesson(source)));
  }
});

test('schema property sets track the authored TypeScript declarations', () => {
  // Use the repository's stable TS compiler API, rather than the player's native TS 7 compiler.
  const ts = createRequire(new URL('../../../package.json', import.meta.url))('typescript');
  const source = ts.createSourceFile('lesson.ts', readFileSync(new URL('../src/lesson.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const declarations = new Map(source.statements.filter((node: any) => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)).map((node: any) => [node.name.text, node]));
  const properties = (node: any): string[] => {
    if (ts.isTypeAliasDeclaration(node)) return properties(node.type);
    if (ts.isUnionTypeNode(node)) return node.types.flatMap(properties);
    if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
      const own = node.members.filter((member: any) => ts.isPropertySignature(member)).map((member: any) => member.name.text);
      return [...own, ...(node.heritageClauses ?? []).flatMap((clause: any) => clause.types.flatMap((type: any) => properties(declarations.get(type.expression.text))))];
    }
    return [];
  };
  for (const [name, shape] of [
    ['Lesson', schema], ['Step', schema.definitions.step], ['AddressMapping', schema.definitions.addressMapping],
    ['BadgeSpec', schema.definitions.badge], ['ConvertSpec', schema.definitions.convert],
    ['AssignSpec', schema.definitions.assign], ['UpdateSpec', schema.definitions.update],
    ['AppendSpec', schema.definitions.append], ['AllocateSpec', schema.definitions.allocate],
    ['CallSpec', schema.definitions.call], ['ReturnSpec', schema.definitions.return],
    ['ErrorSpec', schema.definitions.error], ['OutputSpec', schema.definitions.output.anyOf[1]],
  ] as const) {
    assert.deepEqual(Object.keys(shape.properties).sort(), [...new Set(properties(declarations.get(name)))].sort(), name);
  }
});

test('schema rejects wrong types, unknown keys, missing fields, nested values, and old location forms', () => {
  for (const step of [
    { typo: 1 }, { line: 0 }, { line: 1.5 }, { caption: 5 }, { input: 30 },
    { badge: { over: 'x' } }, { badge: { over: 'x', value: 1, typo: true } },
    { badge: { over: 'x', value: NaN } }, { badge: { over: 'x', value: Infinity } },
    { badge: { over: 'x', value: [[1]] } }, { badge: { over: 'x', value: { ref: 'list-1' } } },
    { convert: {} }, { print: { from: 'badge' } }, { print: { text: 'hi', from: 'console' } },
    { assign: { var: 'x' } }, { assign: { var: 'x', ref: 'id', value: 1 } },
    { assign: { var: 'x', ref: 'id', from: 'badge' } }, { assign: { var: 'x', ref: 'id', type: 'list' } },
    { update: { target: 'x[0]' } }, { append: { target: 'x', value: [] } },
    { allocate: { id: 'id' } }, { allocate: { id: 'id', value: [], fields: {} } },
    { allocate: { id: 'id', value: [], class: 'Student' } }, { allocate: { id: 'id', fields: { nested: [] } } },
    { call: { name: 'f', line: 1 } }, { call: { name: 'f', line: 1, over: 'f()', args: [{ var: 'x' }] } },
    { return: {} }, { error: { kind: 'runtime', name: 'Oops', line: 1 } },
    { error: { kind: 'runtime', name: 'Oops', message: 'Failed', line: 1, nth: 1 } },
    { error: { kind: 'runtime', name: ' ', message: 'Failed', line: 1 } },
    { badge: { over: 'x', value: 1, from: { var: 'x' } } },
    { select: { var: 'x', index: 0 } }, { remove: { target: 'x', index: 0 } },
    { update: { var: 'x', index: 0, value: 1 } }, { append: { var: 'x', value: 1 } },
  ]) check(lesson(step), false);
  for (const data of [
    {}, { ...lesson({}), extra: true }, { ...lesson({}), language: 1 },
    { ...lesson({}), code: null }, { ...lesson({}), steps: {} },
  ]) check(data, false);
});

test('schema address patterns agree with the parser and constrain each action', () => {
  const validateAddress = ajv.compile(schema.definitions.address);
  const addresses = ['x', '_name2', 'x[0]', 'x[01]', 'x["k"]', "x['k']", String.raw`x["a\"b]"]`, 'ada.name',
    String.raw`x["a\u0020b"]`, '', ' x', 'x[ 0]', 'x["two words"]', 'x[-1]', 'x[0.5]', 'x[0][1]', 'x.name.other', '1name', 'x[""]', "x['']", 'x["bad]', 'x["a\u0000b"]', String.raw`x['a\b']`];
  for (const address of addresses) {
    let parsed = true;
    try { parseAddress(address, message => { throw new Error(message); }); } catch { parsed = false; }
    assert.equal(validateAddress(address), parsed, address);
  }
  for (const target of ['x[0]', 'x["k"]', 'ada.name']) {
    check(lesson({ update: { target, value: null } }), true);
    check(lesson({ append: { target, value: 1 } }), false);
  }
  check(lesson({ update: { target: 'x', value: 1 } }), false);
  for (const action of ['select', 'remove']) {
    check(lesson({ [action]: 'x[0]' }), true);
    check(lesson({ [action]: { target: 'x[0]', scope: 'global' } }), true);
    for (const target of ['x', 'x.name', 'x["k"]']) check(lesson({ [action]: target }), false);
  }
  check(lesson({ select: null }), true);
  check(lesson({ badge: { over: 'x', value: 1, from: 'console' } }), true);
  check(lesson({ badge: { over: 'x', value: 1, from: { target: 'console' } } }), true);
  check(lesson({ badge: { over: 'x', value: 1, from: { target: 'x', scope: 'local' } } }), false);
});

test('schema catches action ordering traps but preserves supported combined steps and value overrides', () => {
  for (const action of ['call', 'return', 'error']) {
    const spec = action === 'call' ? { name: 'f', line: 1, over: 'f()' } : action === 'return' ? { value: null } : { kind: 'runtime', name: 'Oops', message: 'Failed', line: 1 };
    check(lesson({ [action]: spec, caption: 'Explain.' }), true);
    check(lesson({ [action]: spec, line: 1 }), false);
  }
  for (const [a, b] of [['update', 'append'], ['update', 'remove'], ['append', 'remove']]) {
    const specs: Record<string, unknown> = { update: { target: 'x[0]', value: 1 }, append: { target: 'x', value: 1 }, remove: 'x[0]' };
    check(lesson({ [a]: specs[a], [b]: specs[b] }), false);
  }
  for (const output of ['print', 'write']) {
    for (const action of [{ badge: { over: 'x', value: 1 } }, { convert: { value: 1 } }]) {
      check(lesson({ ...action, [output]: { text: '1', from: 'badge' } }), false);
      check(lesson({ ...action, [output]: '1' }), true);
    }
  }
  check(lesson({ badge: { over: 'x', value: '1' }, convert: { value: 1 }, assign: { var: 'x', from: 'badge' } }), true);
  check(lesson({ allocate: { id: 'id', value: [] }, assign: { var: 'x', ref: 'id' } }), true);
  for (const action of ['assign', 'update', 'append', 'return']) {
    const binding = action === 'assign' ? { var: 'x' } : action === 'return' ? {} : { target: action === 'update' ? 'x[0]' : 'x' };
    check(lesson({ [action]: { ...binding, value: null, from: 'badge' } }), true);
  }
});

test('semantic errors remain the responsibility of snapshot generation', () => {
  const data = { language: 'python', code: 'x', steps: [
    { line: 1, assign: { var: 'x', value: 1 } },
    { badge: { over: 'x', value: 99, from: 'x' } },
  ] };
  check(data, true);
  assert.throws(() => buildSnapshots(parseLesson(JSON.stringify(data))), /doesn't match/);
});
