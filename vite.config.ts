import { defineConfig } from 'vite';

// `npm run dev` serves index.html as a demo page.
// `npm run build` produces dist/code-loupe.js for embedding on other sites.
// `npm run build:playground` builds the demo and authoring site separately.
export default defineConfig(({ mode }) => ({
  build: mode === 'playground' ? {
    outDir: 'dist/playground',
    rolldownOptions: { input: ['index.html', 'playground.html'] },
  } : {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'code-loupe',
    },
  },
}));
