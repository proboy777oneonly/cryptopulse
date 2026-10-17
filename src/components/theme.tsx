'use client'

import { useEffect, useRef } from 'react'
import { useApp } from '@/stores/app-store'

// ─── Применяет тему и флаги эффектов к <html> ──────────────────────────

export function ThemeApplier() {
  const theme = useApp((s) => s.theme)
  const animations = useApp((s) => s.effects.animations)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.anim = animations ? 'on' : 'off'
  }, [theme, animations])

  return null
}

// ─── Частицы звёздного неба (тема «Полночь») ──────────────────────────

function Particles() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    interface Star { x: number; y: number; r: number; a: number; da: number; vy: number; hue: number }
    let stars: Star[] = []
    interface Shoot { x: number; y: number; vx: number; vy: number; life: number }
    let shoots: Shoot[] = []

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(120, Math.floor((w * h) / 18000))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random(),
        da: (Math.random() * 0.02 + 0.004) * (Math.random() < 0.5 ? 1 : -1),
        vy: -(Math.random() * 0.08 + 0.02),
        hue: Math.random() < 0.75 ? 220 : 265,
      }))
    }

    // ограничение до ~30 кадров/с — в 2 раза меньше нагрузки при том же виде
    const FRAME_MS = 1000 / 30
    let lastFrame = 0
    let running = true

    const frame = (t: number) => {
      if (!running) return
      raf = requestAnimationFrame(frame)
      if (t - lastFrame < FRAME_MS) return
      lastFrame = t
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        s.a += s.da
        if (s.a > 1 || s.a < 0.08) s.da *= -1
        s.y += s.vy
        if (s.y < -4) s.y = h + 4
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${s.hue}, 85%, 80%, ${Math.max(0.05, s.a * 0.85)})`
        ctx.fill()
      }
      if (Math.random() < 0.006 && shoots.length < 2) {
        shoots.push({ x: Math.random() * w * 0.7, y: Math.random() * h * 0.3, vx: 4 + Math.random() * 4, vy: 2 + Math.random() * 2, life: 1 })
      }
      for (let i = shoots.length - 1; i >= 0; i--) {
        const sh = shoots[i]
        sh.x += sh.vx
        sh.y += sh.vy
        sh.life -= 0.02
        const grad = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 12, sh.y - sh.vy * 12)
        grad.addColorStop(0, `rgba(165, 210, 255, ${Math.max(0, sh.life)})`)
        grad.addColorStop(1, 'rgba(165, 210, 255, 0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(sh.x, sh.y)
        ctx.lineTo(sh.x - sh.vx * 12, sh.y - sh.vy * 12)
        ctx.stroke()
        if (sh.life <= 0 || sh.x > w + 60 || sh.y > h + 60) shoots.splice(i, 1)
      }
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(frame)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" aria-hidden />
}

// ─── Слои эффектов тем ────────────────────────────────────────────────

export function ThemeEffects() {
  const theme = useApp((s) => s.theme)
  const fx = useApp((s) => s.effects)

  if (theme === 'midnight') {
    return (
      <>
        {fx.particles && <Particles />}
        {fx.glow && (
          <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
            <div className="cp-fx-blob absolute -top-40 left-1/4 h-[520px] w-[520px] rounded-full opacity-25 blur-[120px]" style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }} />
            <div className="cp-fx-blob-slow absolute -right-40 top-1/3 h-[480px] w-[480px] rounded-full opacity-20 blur-[120px]" style={{ background: 'radial-gradient(circle, #0EA5E9 0%, transparent 70%)' }} />
          </div>
        )}
      </>
    )
  }

  if (theme === 'terminal') {
    return (
      <>
        {fx.scanlines && (
          <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
            <div className="absolute inset-0 cp-scanlines" />
            <div className="absolute inset-0 cp-vignette" />
          </div>
        )}
        {fx.glow && (
          <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.06]" aria-hidden>
            <div className="absolute inset-0 cp-grid-green" />
          </div>
        )}
      </>
    )
  }

  if (theme === 'sunset') {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        {fx.particles && (
          <>
            <div className="cp-aurora-1 absolute -left-32 -top-32 h-[560px] w-[560px] rounded-full opacity-30 blur-[110px]" style={{ background: 'radial-gradient(circle, #EC4899 0%, transparent 70%)' }} />
            <div className="cp-aurora-2 absolute -bottom-40 -right-24 h-[600px] w-[600px] rounded-full opacity-25 blur-[110px]" style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)' }} />
            <div className="cp-aurora-3 absolute left-1/3 top-1/4 h-[420px] w-[420px] rounded-full opacity-20 blur-[100px]" style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }} />
          </>
        )}
        {fx.glow && <div className="absolute inset-0 cp-sunset-overlay" />}
      </div>
    )
  }

  // crystal
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {fx.particles && (
        <>
          <div className="cp-blob-1 absolute -left-24 -top-24 h-[440px] w-[440px] rounded-full opacity-50 blur-[90px]" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />
          <div className="cp-blob-2 absolute -bottom-28 -right-20 h-[460px] w-[460px] rounded-full opacity-50 blur-[90px]" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.2) 0%, transparent 70%)' }} />
          <div className="cp-blob-3 absolute left-2/5 top-1/3 h-[320px] w-[320px] rounded-full opacity-40 blur-[80px]" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 70%)' }} />
        </>
      )}
    </div>
  )
}
