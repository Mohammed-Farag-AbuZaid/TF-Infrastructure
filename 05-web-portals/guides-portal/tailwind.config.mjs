import tfPreset from '../../packages/tokens/dist/tailwind-preset.cjs';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [tfPreset],
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
