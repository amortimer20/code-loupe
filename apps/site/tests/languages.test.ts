import { test } from 'node:test';
import assert from 'node:assert/strict';
import { languageChoices } from '../src/authoring/languages';
const catalog = [{ id:'rust', name:'Rust' }, { id:'python', name:'Python', aliases:['py'] }, { id:'javascript', name:'JavaScript', aliases:['js'] }];

test('language choices prioritize teaching languages without changing imported aliases or unknown names', () => {
  assert.deepEqual(languageChoices(catalog, 'python').map(choice => choice.id), ['python','javascript','rust']);
  assert.deepEqual(languageChoices(catalog, 'py')[0], { id:'py', name:'Python (py)' });
  assert.equal(languageChoices(catalog, 'custom')[0].id, 'custom');
  assert.equal(languageChoices(catalog, '')[0].name, 'Choose a language');
  assert.equal(catalog[0].id, 'rust');
});
