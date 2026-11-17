import { defineConfig } from 'astro/config';

export default defineConfig({
  // Change to your real domain once deployed (used for RSS links).
  site: 'https://perkinyang.com',
  // The floating dev toolbar sits on top of the design, so it stays off.
  devToolbar: { enabled: false },
  // Start loading a page as soon as its link is hovered or touched, so the click feels instant.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
