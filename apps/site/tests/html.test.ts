import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeHtml, html, raw } from '../src/authoring/html';

const hostile = `<img src=x onerror="alert('1')"> & </textarea>`;

test('interpolated values are escaped, with the same entities the builder always used', () => {
  assert.equal(escapeHtml(hostile), '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt; &amp; &lt;/textarea&gt;');
  assert.equal(String(html`<p title="${hostile}">${hostile}</p>`),
    '<p title="&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt; &amp; &lt;/textarea&gt;">&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt; &amp; &lt;/textarea&gt;</p>');
  assert.equal(String(html`${undefined}${null}`), '');
  assert.equal(String(html`${false}|${true}|${0}|${12}`), 'false|true|0|12');
});

test('markup passes through only when built by html or marked raw, and is never escaped twice', () => {
  const inner = html`<b>${hostile}</b>`;
  assert.equal(String(html`<p>${inner}</p>`), `<p><b>${escapeHtml(hostile)}</b></p>`);
  assert.equal(String(html`${raw('<hr>')}`), '<hr>');
  // A plain string that happens to hold markup is text, so it cannot become an element.
  assert.equal(String(html`${'<hr>'}`), '&lt;hr&gt;');
  assert.equal(String(html`${String(inner)}`), escapeHtml(String(inner)));
});

test('arrays concatenate their escaped or markup items without separators', () => {
  assert.equal(String(html`<ul>${['a', '<b>', html`<li>x</li>`].map(item => html`<li>${item}</li>`)}</ul>`), '<ul><li>a</li><li>&lt;b&gt;</li><li><li>x</li></li></ul>');
  assert.equal(String(html`${['<', raw('<'), html`<${'>'}`]}`), '&lt;<<&gt;');
  assert.equal(String(html`${[]}`), '');
});
