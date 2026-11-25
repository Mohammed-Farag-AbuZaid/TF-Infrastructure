import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://guides.tfunions.com',
  output: 'static',
  integrations: [tailwind()],
});
