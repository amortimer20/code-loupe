import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  output: 'static',
  vite: {
    worker: { format: 'es' },
    resolve: { alias: [{
      find: /.*\/dompurify\/dompurify\.js$/,
      replacement: fileURLToPath(new URL('./src/editor-sanitizer.ts', import.meta.url)),
    }] },
  },
});
