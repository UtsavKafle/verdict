import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Verdict',
    short_name: 'Verdict',
    description: 'Cast your vote. See the crowd’s verdict.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4ede2',
    theme_color: '#f4ede2',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
