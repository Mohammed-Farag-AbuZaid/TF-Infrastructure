import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.tfunions.org',
  integrations: [
    starlight({
      title: 'TF Unions Docs & Wiki',
      description: 'Official documentation, FAQ, and organizational charter for the TF Unions educational ecosystem.',
      social: {
        github: 'https://github.com/Mohammed-Farag-AbuZaid/TF-Infrastructure',
      },
      sidebar: [
        {
          label: 'Overview & Charter',
          items: [
            { label: 'Welcome to TF Unions', slug: 'index' },
            { label: 'Frequently Asked Questions', slug: 'faq' },
            { label: 'Unified SSO & Account Guide', slug: 'sso-guide' },
          ],
        },
      ],
    }),
  ],
});
