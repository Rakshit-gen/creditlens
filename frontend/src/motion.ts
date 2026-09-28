import { useEffect, useRef, useState } from 'react'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Eases a number toward its target so changes read as movement instead of a jump. */
export function useTween(target: number, ms = 520): number {
  const [value, setValue] = useState(target)
  const from = useRef(target)

  useEffect(() => {
    if (reduced()) {
      from.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    const origin = from.current
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 4)
      from.current = origin + (target - origin) * eased
      setValue(from.current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, ms])

  return value
}
