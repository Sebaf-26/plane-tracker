export default function Compass({ heading, size = 72 }) {
  const angle = heading ?? 0
  const r = size / 2
  const cx = r
  const cy = r

  // Needle tip and tail relative to center
  const needleLen = r * 0.62
  const tailLen   = r * 0.32
  const toRad = (deg) => (deg - 90) * (Math.PI / 180)

  const tipX  = cx + Math.cos(toRad(angle)) * needleLen
  const tipY  = cy + Math.sin(toRad(angle)) * needleLen
  const tailX = cx - Math.cos(toRad(angle)) * tailLen
  const tailY = cy - Math.sin(toRad(angle)) * tailLen

  // Wing offsets (perpendicular)
  const wingW = r * 0.13
  const perpX = -Math.sin(toRad(angle))
  const perpY =  Math.cos(toRad(angle))

  const cardinal = ['N','E','S','W']
  const cardAngles = [0, 90, 180, 270]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r - 1} fill="var(--card-inner)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>

      {/* Tick marks */}
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i * 10 - 90) * (Math.PI / 180)
        const isMajor = i % 9 === 0
        const inner = r - (isMajor ? 10 : 6)
        const outer = r - 2
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * inner}
            y1={cy + Math.sin(a) * inner}
            x2={cx + Math.cos(a) * outer}
            y2={cy + Math.sin(a) * outer}
            stroke={isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)'}
            strokeWidth={isMajor ? 1.5 : 0.8}
          />
        )
      })}

      {/* Cardinal labels */}
      {cardAngles.map((deg, i) => {
        const a = (deg - 90) * (Math.PI / 180)
        const dist = r - 17
        return (
          <text
            key={deg}
            x={cx + Math.cos(a) * dist}
            y={cy + Math.sin(a) * dist + 4}
            textAnchor="middle"
            fontSize={r * 0.22}
            fontWeight="700"
            fill={deg === 0 ? '#fac123' : 'rgba(255,255,255,0.6)'}
            fontFamily="-apple-system, sans-serif"
          >
            {cardinal[i]}
          </text>
        )
      })}

      {/* Needle tail (white) */}
      <polygon
        points={`
          ${tipX},${tipY}
          ${cx + perpX * wingW},${cy + perpY * wingW}
          ${tailX},${tailY}
          ${cx - perpX * wingW},${cy - perpY * wingW}
        `}
        fill="rgba(255,255,255,0.25)"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.5"
      />

      {/* Needle head (yellow) */}
      <polygon
        points={`
          ${tipX},${tipY}
          ${cx + perpX * wingW},${cy + perpY * wingW}
          ${cx},${cy}
          ${cx - perpX * wingW},${cy - perpY * wingW}
        `}
        fill="#fac123"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="0.5"
      />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={r * 0.07} fill="#fff" opacity="0.9"/>

      {/* Degree label */}
      <text
        x={cx} y={size - 4}
        textAnchor="middle"
        fontSize={r * 0.2}
        fill="rgba(255,255,255,0.4)"
        fontFamily="var(--font-mono)"
      >
        {Math.round(angle)}°
      </text>
    </svg>
  )
}
