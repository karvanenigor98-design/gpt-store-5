'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

/** Базовый размер кольца (px) — на десктопе чуть меньше прежнего 26. */
const RING_SIZE = 22
/** Масштаб при наведении на кликабельные элементы (визуально ~30px). */
const RING_HOVER_SCALE = 30 / RING_SIZE
const DOT_SIZE = 6

const INTERACTIVE =
  'a,button,[role="button"],[role="link"],input,textarea,select,label,summary,.cursor-pointer'

export function CursorTrail() {
  const mx = useMotionValue(-300)
  const my = useMotionValue(-300)
  const dx = useMotionValue(-300)
  const dy = useMotionValue(-300)

  const ringX = useSpring(mx, { damping: 32, stiffness: 320, mass: 0.35 })
  const ringY = useSpring(my, { damping: 32, stiffness: 320, mass: 0.35 })
  const dotX = useSpring(dx, { damping: 55, stiffness: 700 })
  const dotY = useSpring(dy, { damping: 55, stiffness: 700 })

  const [hover, setHover] = useState(false)
  const [visible, setVisible] = useState(false)
  const [touch, setTouch] = useState(false)

  const hoverRef = useRef(false)
  const visibleRef = useRef(false)
  const rafId = useRef<number | null>(null)
  const pos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(hover: none)').matches) {
      setTouch(true)
      return
    }

    document.documentElement.classList.add('use-custom-cursor')

    const applyPos = () => {
      rafId.current = null
      const { x, y } = pos.current
      mx.set(x)
      my.set(y)
      dx.set(x)
      dy.set(y)
    }

    const move = (e: MouseEvent) => {
      pos.current.x = e.clientX
      pos.current.y = e.clientY
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(applyPos)
      }

      const t = e.target as HTMLElement
      const next = !!t.closest(INTERACTIVE)
      if (next !== hoverRef.current) {
        hoverRef.current = next
        setHover(next)
      }

      if (!visibleRef.current) {
        visibleRef.current = true
        setVisible(true)
      }
    }

    const leave = () => {
      visibleRef.current = false
      setVisible(false)
    }
    const enter = () => {
      visibleRef.current = true
      setVisible(true)
    }

    document.addEventListener('mousemove', move, { passive: true })
    document.addEventListener('mouseleave', leave)
    document.addEventListener('mouseenter', enter)
    return () => {
      document.documentElement.classList.remove('use-custom-cursor')
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseleave', leave)
      document.removeEventListener('mouseenter', enter)
    }
  }, [mx, my, dx, dy])

  if (touch) return null

  return (
    <>
      {/* Кольцо: фиксированный размер + scale — без layout на каждом кадре */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none rounded-full will-change-transform"
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
          zIndex: 999999,
          width: RING_SIZE,
          height: RING_SIZE,
          border: '2px solid #111827',
        }}
        initial={false}
        animate={{
          scale: hover ? RING_HOVER_SCALE : 1,
          opacity: visible ? 1 : 0,
          backgroundColor: hover
            ? 'rgba(16,163,127,0.16)'
            : 'rgba(255,255,255,0.3)',
          boxShadow: hover
            ? '0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px rgba(17,24,39,0.8), 0 0 14px rgba(16,163,127,0.45)'
            : '0 0 0 2px rgba(255,255,255,0.95), 0 0 0 4px rgba(17,24,39,0.82), 0 0 8px rgba(17,24,39,0.25)',
        }}
        transition={{ type: 'tween', duration: 0.12, ease: 'easeOut' }}
      />
      <motion.div
        className="fixed top-0 left-0 pointer-events-none rounded-full will-change-transform"
        style={{
          x: dotX,
          y: dotY,
          translateX: '-50%',
          translateY: '-50%',
          zIndex: 999999,
          width: DOT_SIZE,
          height: DOT_SIZE,
          backgroundColor: '#111827',
          border: '1px solid rgba(255,255,255,0.95)',
          boxShadow: '0 0 0 1px rgba(17,24,39,0.5), 0 0 6px rgba(17,24,39,0.45)',
        }}
        initial={false}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.08 }}
      />
    </>
  )
}
