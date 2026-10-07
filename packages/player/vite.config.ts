import { defineConfig } from 'vite';

// The player builds independently of the Astro sample site.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'code-loupe',
    },
  },
});
