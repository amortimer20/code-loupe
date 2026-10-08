import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

// Serve both production outputs. The fixture and player route exist only in
// this test server; they are not added to the published sample site.
const site = resolve('apps/site/dist');
const player = resolve('packages/player/dist');
const fixtures = resolve('tests/browser/fixtures');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.yaml': 'application/yaml', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
await stat(resolve(site, 'index.html'));
await stat(resolve(player, 'code-loupe.js'));

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const [root, relative] = pathname.startsWith('/__test/player/')
      ? [player, pathname.slice('/__test/player/'.length)]
      : pathname.startsWith('/__test/fixtures/')
        ? [fixtures, pathname.slice('/__test/fixtures/'.length)] : [site, pathname.slice(1)];
    let file = resolve(root, relative);
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Outside root');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(4321, '127.0.0.1', () => console.log('Test site: http://127.0.0.1:4321'));
