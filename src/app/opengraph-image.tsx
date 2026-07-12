import { ImageResponse } from 'next/og'

// Branded 1200×630 share card for every public page (child segments can
// override with their own opengraph-image if a page ever needs a custom one).
// Kept to Satori-safe CSS: flex layout, inline styles, CSS gradients.

export const alt = 'HadIdea — Have an idea? Make it real.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#020617',
          backgroundImage:
            'radial-gradient(ellipse 600px 400px at 15% 10%, rgba(79,70,229,0.45), transparent), radial-gradient(ellipse 600px 400px at 90% 95%, rgba(6,182,212,0.3), transparent)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em' }}>
          HadIdea
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 48,
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
          }}
        >
          <span>Have an idea?</span>
          <span
            style={{
              backgroundImage: 'linear-gradient(90deg, #a5b4fc, #22d3ee)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Let&rsquo;s make it real.
          </span>
        </div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 32, color: '#94a3b8' }}>
          Real competitors. Real costs. Real plans — researched in minutes.
        </div>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 30, fontWeight: 600, color: '#cbd5e1' }}>
          hadidea.com
        </div>
      </div>
    ),
    size
  )
}
