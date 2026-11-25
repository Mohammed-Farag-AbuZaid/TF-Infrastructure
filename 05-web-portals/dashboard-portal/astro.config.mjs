import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://dashboard.tfunions.com',
  output: 'static',
  integrations: [tailwind()],
});
