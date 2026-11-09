import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://verify.tfunions.com',
  output: 'static',
  integrations: [tailwind()],
});

