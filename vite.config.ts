import { defineConfig } from 'vite';
import { contentPlugin } from './scripts/content-plugin';

// oakchaser.me is a custom-domain user page → served from root.
export default defineConfig({
  base: '/',
  plugins: [contentPlugin()],
  server: {
    host: 'localhost',
  },
});
