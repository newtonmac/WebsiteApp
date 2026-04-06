import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Water Conditions — PaddlePoint';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0d9488 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
        }}
      >
        <div style={{ fontSize: 48, color: '#5eead4', marginBottom: 16 }}></div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: 'white',
            textAlign: 'center',
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          Water Conditions
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: 800,
          }}
        >
          Live wind, waves, tides & water quality
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 22,
            color: '#5eead4',
            fontWeight: 600,
          }}
        >
          paddlepoint.org
        </div>
      </div>
    ),
    size,
  );
}
