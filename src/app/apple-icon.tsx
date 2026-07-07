import { ImageResponse } from 'next/og';

// iOS home-screen icon must be a raster image, so we generate a PNG here
// (Satori doesn't support oklch, hence the hex plum/cream).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#9c5ca6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f4ede2',
          fontSize: 120,
          fontWeight: 900,
        }}
      >
        V
      </div>
    ),
    { ...size }
  );
}
