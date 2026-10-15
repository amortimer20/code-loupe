/** Read a lesson's YAML from the host's `src` attribute, or from an inline YAML script child. */
export async function readLessonSource(host: HTMLElement): Promise<string> {
  const src = host.getAttribute('src');
  if (src) {
    const response = await fetch(new URL(src, document.baseURI));
    if (!response.ok) throw new Error(`${src} returned ${response.status} ${response.statusText}.`);
    return response.text();
  }
  const inline = host.querySelector('script[type="text/yaml"], script[type="application/yaml"]');
  if (inline?.textContent) return dedent(inline.textContent);
  throw new Error('Set a `src` attribute or put the lesson in a <script type="text/yaml"> child.');
}

/** Remove the common indentation from inline YAML so it can be indented to match the page's HTML. */
function dedent(text: string) {
  const lines = text.replace(/^\n+|\s+$/g, '').split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent)).join('\n');
}
