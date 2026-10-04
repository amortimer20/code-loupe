import { defineConfig } from 'vite';

// `npm run dev` serves index.html as a demo page.
// `npm run build` produces dist/code-animator.js for embedding on other sites.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'code-animator',
    },
  },
});
