const CURVES = [
  { R: 70, r: 11, phase: 0 },
  { R: 64, r: 13, phase: 0.6 },
  { R: 58, r: 9, phase: 1.3 },
]
const SAMPLES = 900

/** Security-print rosette. Its shape follows the (tweened) risk, so it only moves when the score does. */
export default function Guilloche({ risk }: { risk: number }) {
  const d = 14 + risk * 34
  const paths = CURVES.map(({ R, r, phase }) => {
    const k = (R - r) / r
    let path = ''
    for (let i = 0; i <= SAMPLES; i++) {
      const t = (i / SAMPLES) * Math.PI * 2 * r
      const x = (R - r) * Math.cos(t + phase) + d * Math.cos(k * t)
      const y = (R - r) * Math.sin(t + phase) - d * Math.sin(k * t)
      path += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    }
    return path
  })

  return (
    <svg className="guilloche" viewBox="-130 -130 260 260" aria-hidden="true" style={{ transform: `rotate(${risk * 140}deg)` }}>
      {paths.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  )
}
