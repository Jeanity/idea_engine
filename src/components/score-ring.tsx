import { bandFor } from '@/lib/score-bands'

// Circular progress ring for a 0–100 score. Shared by the landing page
// marquee, the account page's ideas list, and the report viewer, so the same
// visual language (color bands, draw-in animation via .score-ring-progress
// in globals.css) shows up everywhere a score appears.
export function ScoreRing({ score, label, size = 64 }: { score: number; label: string; size?: number }) {
  const band = bandFor(score)
  const strokeWidth = size * 0.11
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="score-ring"
        role="img"
        aria-label={`${label}: ${score} out of 100`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={band.trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          className="score-ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={band.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50% 50%',
            ['--score-ring-circumference' as string]: circumference,
            ['--score-ring-final-offset' as string]: offset,
            strokeDashoffset: offset,
          }}
        />
        <text
          x="50%"
          y="50%"
          dy="0.32em"
          textAnchor="middle"
          className="fill-white light:fill-gray-900 text-sm font-semibold"
          style={{ fontSize: size * 0.22 }}
        >
          {score}
        </text>
      </svg>
      {label && <span className="mt-1 text-[10px] text-slate-400 light:text-gray-500">{label}</span>}
    </div>
  )
}
