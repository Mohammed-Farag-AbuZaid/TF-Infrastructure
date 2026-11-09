import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://docs.tfunions.com',
  output: 'static',
  integrations: [tailwind()],
});
