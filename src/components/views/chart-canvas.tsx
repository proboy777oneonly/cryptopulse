'use client'

// ════════════════════════════════════════════════════════════════════
// Canvas-график свечей: зум колесом, панорама драгом, кроссхэйр,
// инструменты рисовалки (тренд/гориз/верт/прямоугольник/фибо),
// линейка на колёсико мыши (средняя кнопка) и в тулбаре.
// Рисунки хранятся в localStorage по ключу графика.
// ════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }
export type ChartTool = 'cursor' | 'trend' | 'hline' | 'vline' | 'rect' | 'fib' | 'ruler'
export type DrawType = 'trend' | 'hline' | 'vline' | 'rect' | 'fib'

export interface ChartDrawing {
  id: string
  type: DrawType
  points: { t: number; p: number }[]
}

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const TWO_POINT: DrawType[] = ['trend', 'rect', 'fib']

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

function niceStep(range: number, n: number): number {
  const raw = range / Math.max(1, n)
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return step * mag
}

export function fmtChartPrice(p: number): string {
  const a = Math.abs(p)
  if (a >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 1 })
  if (a >= 100) return p.toFixed(2)
  if (a >= 1) return p.toFixed(3)
  if (a >= 0.01) return p.toFixed(5)
  if (a >= 0.0001) return p.toFixed(7)
  return p.toExponential(3)
}

function fmtAxisTime(t: number, interval: string): string {
  const d = new Date(t)
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (interval === '1d' || interval === '1w') {
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
  }
  if (interval === '1h' || interval === '4h') {
    return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })} ${hhmm}`
  }
  return hhmm
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 90) return `${s}с`
  const m = Math.round(s / 60)
  if (m < 90) return `${m}м`
  const h = Math.round(m / 60)
  if (h < 36) return `${h}ч`
  return `${Math.round(h / 24)}д`
}

interface MouseState {
  x: number
  y: number
  inside: boolean
  mode: 'idle' | 'pan' | 'draw2' | 'drag' | 'ruler'
  startX: number
  startY: number
  startOffset: number
  pending?: { t: number; p: number }
  hoverId?: string
  grab?: { id: string; orig: { t: number; p: number }[]; idxStart: number; priceStart: number }
}

let drawId = 0

function loadDrawings(key: string): ChartDrawing[] {
  try {
    const raw = localStorage.getItem(`cp-draw-${key}`)
    if (!raw) return []
    const arr = JSON.parse(raw) as ChartDrawing[]
    return Array.isArray(arr) ? arr.filter((d) => d && d.type && Array.isArray(d.points)) : []
  } catch {
    return []
  }
}

function saveDrawings(key: string, list: ChartDrawing[]) {
  try {
    localStorage.setItem(`cp-draw-${key}`, JSON.stringify(list))
  } catch { /* quota — игнорируем */ }
}

export interface CandleChartProps {
  candles: Candle[]
  interval: string
  /** ключ персистентности рисовалок; undefined — рисовалки выключены */
  chartKey?: string
  tool?: ChartTool
  onToolDone?: () => void
  livePrice?: number
  /** тема — триггер перерисовки при смене палитры */
  theme?: string
  className?: string
  showVolume?: boolean
  /** false = только кроссхэйр (мини-график) */
  interactive?: boolean
  /** инкремент извне → очистить все рисунки */
  clearTick?: number
}

export function CandleChart({
  candles, interval, chartKey, tool = 'cursor', onToolDone, livePrice,
  theme, className, showVolume = true, interactive = true, clearTick,
}: CandleChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef({ bars: 130, offset: 0 })
  const mouseRef = useRef<MouseState>({ x: 0, y: 0, inside: false, mode: 'idle', startX: 0, startY: 0, startOffset: 0 })
  const drawingsRef = useRef<ChartDrawing[]>([])
  const rulerRef = useRef<{ t1: number; p1: number; t2: number; p2: number } | null>(null)
  const candlesRef = useRef<Candle[]>(candles)
  const toolRef = useRef(tool)
  const sizeRef = useRef({ w: 0, h: 0 })

  // зеркала пропсов в рефах — только внутри эффектов
  useEffect(() => { candlesRef.current = candles }, [candles])
  useEffect(() => { toolRef.current = tool }, [tool])

  // ── Цвета из CSS-переменных темы ──────────────────────────────────
  const readColors = useCallback(() => {
    if (typeof window === 'undefined') {
      return { bg: '#0b0e17', fg: '#e2e8f0', grid: 'rgba(255,255,255,0.06)', muted: '#7c8aa5', border: 'rgba(255,255,255,0.1)', pos: '#34d399', neg: '#f43f5e', acc: '#8b5cf6', card: '#111524' }
    }
    const cs = getComputedStyle(document.documentElement)
    const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
    return {
      bg: v('--card-solid', '#0b0e17'),
      fg: v('--foreground', '#e2e8f0'),
      grid: v('--border', 'rgba(255,255,255,0.1)'),
      muted: v('--muted-foreground', '#7c8aa5'),
      border: v('--border', 'rgba(255,255,255,0.1)'),
      pos: v('--pos', '#34d399'),
      neg: v('--neg', '#f43f5e'),
      acc: v('--acc', '#8b5cf6'),
      card: v('--card-solid', '#111524'),
    }
  }, [])

  // ── Геометрия ─────────────────────────────────────────────────────
  const geom = useCallback(() => {
    const w = sizeRef.current.w
    const h = sizeRef.current.h
    const padL = 6, padR = 64, padT = 10, padB = 20
    const plotW = Math.max(30, w - padL - padR)
    const fullH = Math.max(40, h - padT - padB)
    const volH = showVolume ? fullH * 0.16 : 0
    const chartH = fullH - volH - (showVolume ? 8 : 0)
    return { padL, padR, padT, padB, plotW, fullH, volH, chartH }
  }, [showVolume])

  // ── Главная отрисовка ─────────────────────────────────────────────
  const redraw = useCallback(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = sizeRef.current.w
    const h = sizeRef.current.h
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const C = readColors()
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = C.bg
    ctx.fillRect(0, 0, w, h)

    const cs = candlesRef.current
    if (!cs || cs.length < 2) {
      ctx.fillStyle = C.muted
      ctx.font = '12px ui-monospace, Menlo, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Загрузка свечей…', w / 2, h / 2)
      return
    }

    const intervalMs = cs[1].t - cs[0].t || 60_000
    const view = viewRef.current
    view.bars = clamp(view.bars, 15, Math.max(60, cs.length + 40))
    const len = cs.length
    let rightIdx = len - view.offset
    rightIdx = clamp(rightIdx, Math.max(5, view.bars * 0.35), len + view.bars * 0.35)
    const startIdx = rightIdx - view.bars
    const { padL, padR, padT, plotW, volH, chartH, fullH } = geom()
    const barW = plotW / view.bars
    const xOfIdx = (i: number) => padL + (i - startIdx + 0.5) * barW
    const idxOfT = (t: number) => (t - cs[0].t) / intervalMs
    const xOfT = (t: number) => xOfIdx(idxOfT(t))

    const i0 = Math.max(0, Math.floor(startIdx))
    const i1 = Math.min(len - 1, Math.ceil(rightIdx))
    let minP = Infinity, maxP = -Infinity, maxV = 0
    for (let i = i0; i <= i1; i++) {
      if (cs[i].l < minP) minP = cs[i].l
      if (cs[i].h > maxP) maxP = cs[i].h
      if (cs[i].v > maxV) maxV = cs[i].v
    }
    if (livePrice && livePrice > 0) {
      if (livePrice < minP) minP = livePrice
      if (livePrice > maxP) maxP = livePrice
    }
    const padP = (maxP - minP) * 0.07 || Math.abs(maxP) * 0.01 || 1
    minP -= padP
    maxP += padP
    const yOfP = (p: number) => padT + ((maxP - p) / (maxP - minP)) * chartH
    const pOfY = (y: number) => maxP - ((y - padT) / chartH) * (maxP - minP)
    const tOfX = (x: number) => cs[0].t + ((x - padL) / barW + startIdx - 0.5) * intervalMs

    // сетка + шкала цены
    ctx.font = '10px ui-monospace, Menlo, monospace'
    ctx.textBaseline = 'middle'
    const step = niceStep(maxP - minP, 6)
    ctx.strokeStyle = C.grid
    ctx.lineWidth = 1
    ctx.fillStyle = C.muted
    ctx.textAlign = 'left'
    for (let p = Math.ceil(minP / step) * step; p <= maxP; p += step) {
      const y = yOfP(p)
      ctx.beginPath()
      ctx.moveTo(padL, Math.round(y) + 0.5)
      ctx.lineTo(padL + plotW, Math.round(y) + 0.5)
      ctx.stroke()
      ctx.fillText(fmtChartPrice(p), padL + plotW + 6, y)
    }

    // шкала времени
    const labelEvery = Math.max(1, Math.ceil(92 / barW))
    ctx.textAlign = 'center'
    for (let i = i0; i <= i1; i++) {
      if (i % labelEvery !== 0) continue
      const x = xOfIdx(i)
      ctx.strokeStyle = C.grid
      ctx.beginPath()
      ctx.moveTo(Math.round(x) + 0.5, padT)
      ctx.lineTo(Math.round(x) + 0.5, padT + fullH)
      ctx.stroke()
      ctx.fillStyle = C.muted
      ctx.fillText(fmtAxisTime(cs[i].t, interval), x, padT + fullH + 11)
    }

    // объёмы
    if (showVolume && maxV > 0) {
      const volTop = padT + chartH + 8
      for (let i = i0; i <= i1; i++) {
        const cd = cs[i]
        const x = xOfIdx(i)
        const vh = (cd.v / maxV) * volH
        ctx.fillStyle = cd.c >= cd.o ? `${C.pos}33` : `${C.neg}33`
        ctx.fillRect(x - barW * 0.33, volTop + volH - vh, Math.max(1, barW * 0.66), vh)
      }
    }

    // свечи
    const bodyW = Math.max(1, barW * 0.66)
    for (let i = i0; i <= i1; i++) {
      const cd = cs[i]
      const x = xOfIdx(i)
      const up = cd.c >= cd.o
      const col = up ? C.pos : C.neg
      ctx.strokeStyle = col
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(Math.round(x) + 0.5, yOfP(cd.h))
      ctx.lineTo(Math.round(x) + 0.5, yOfP(cd.l))
      ctx.stroke()
      const yO = yOfP(cd.o)
      const yC = yOfP(cd.c)
      const top = Math.min(yO, yC)
      const bh = Math.max(1, Math.abs(yC - yO))
      ctx.fillStyle = col
      ctx.fillRect(x - bodyW / 2, top, bodyW, bh)
    }

    // последняя цена
    const lastC = cs[len - 1]
    const lastP = livePrice && livePrice > 0 ? livePrice : lastC.c
    const lastUp = lastP >= lastC.o
    const yLast = yOfP(lastP)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = lastUp ? C.pos : C.neg
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, Math.round(yLast) + 0.5)
    ctx.lineTo(padL + plotW, Math.round(yLast) + 0.5)
    ctx.stroke()
    ctx.setLineDash([])
    // чип последней цены
    ctx.fillStyle = lastUp ? C.pos : C.neg
    const lpTxt = fmtChartPrice(lastP)
    ctx.font = 'bold 10px ui-monospace, Menlo, monospace'
    const lpW = ctx.measureText(lpTxt).width + 10
    roundRect(ctx, padL + plotW + 2, yLast - 8, Math.min(lpW, padR - 4), 16, 4)
    ctx.fill()
    ctx.fillStyle = '#0b0e17'
    ctx.textAlign = 'left'
    ctx.fillText(lpTxt, padL + plotW + 7, yLast)

    // легенда OHLC hovered
    const ms = mouseRef.current
    const hovIdx = ms.inside ? clamp(Math.round(startIdx + (ms.x - padL) / barW - 0.5), 0, len - 1) : len - 1
    const hcd = cs[hovIdx]
    if (hcd) {
      const chg = hcd.o > 0 ? ((hcd.c - hcd.o) / hcd.o) * 100 : 0
      const up = hcd.c >= hcd.o
      ctx.font = '10px ui-monospace, Menlo, monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = C.muted
      const y0 = padT + 2
      ctx.fillText('O', padL + 4, y0)
      ctx.fillText('H', padL + 62, y0)
      ctx.fillText('L', padL + 130, y0)
      ctx.fillStyle = up ? C.pos : C.neg
      ctx.fillText(fmtChartPrice(hcd.o), padL + 14, y0)
      ctx.fillText(fmtChartPrice(hcd.h), padL + 72, y0)
      ctx.fillText(fmtChartPrice(hcd.l), padL + 140, y0)
      ctx.fillText(`C ${fmtChartPrice(hcd.c)}  ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`, padL + 200, y0)
    }

    // ── Рисунки ────────────────────────────────────────────────────
    const strokeDrawing = (d: ChartDrawing, hover: boolean) => {
      const pts = d.points.map((pt) => ({ x: xOfT(pt.t), y: yOfP(pt.p) }))
      const col = hover ? C.acc : C.acc
      ctx.strokeStyle = col
      ctx.lineWidth = hover ? 2 : 1.5
      ctx.setLineDash([])
      if (d.type === 'trend' && pts.length >= 2) {
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        ctx.lineTo(pts[1].x, pts[1].y)
        ctx.stroke()
        dot(pts[0]); dot(pts[1])
      } else if (d.type === 'hline' && pts.length >= 1) {
        const y = pts[0].y
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(padL + plotW, y)
        ctx.stroke()
        // чип цены справа
        ctx.fillStyle = col
        ctx.font = 'bold 9px ui-monospace, Menlo, monospace'
        const txt = fmtChartPrice(d.points[0].p)
        const tw = ctx.measureText(txt).width + 8
        roundRect(ctx, padL + plotW + 2, y - 7, Math.min(tw, padR - 4), 14, 3)
        ctx.fill()
        ctx.fillStyle = '#0b0e17'
        ctx.fillText(txt, padL + plotW + 6, y)
      } else if (d.type === 'vline' && pts.length >= 1) {
        const x = pts[0].x
        ctx.setLineDash([2, 3])
        ctx.beginPath()
        ctx.moveTo(x, padT)
        ctx.lineTo(x, padT + fullH)
        ctx.stroke()
        ctx.setLineDash([])
      } else if (d.type === 'rect' && pts.length >= 2) {
        const x = Math.min(pts[0].x, pts[1].x), y = Math.min(pts[0].y, pts[1].y)
        const rw = Math.abs(pts[1].x - pts[0].x), rh = Math.abs(pts[1].y - pts[0].y)
        ctx.fillStyle = `${C.acc}14`
        ctx.fillRect(x, y, rw, rh)
        ctx.strokeRect(x, y, rw, rh)
        dot(pts[0]); dot(pts[1])
      } else if (d.type === 'fib' && pts.length >= 2) {
        const p1 = d.points[0], p2 = d.points[1]
        const xa = Math.min(pts[0].x, pts[1].x), xb = Math.max(pts[0].x, pts[1].x)
        ctx.strokeStyle = `${C.acc}cc`
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        ctx.lineTo(pts[1].x, pts[1].y)
        ctx.stroke()
        ctx.font = '9px ui-monospace, Menlo, monospace'
        ctx.textAlign = 'left'
        for (const lv of FIB_LEVELS) {
          const price = p1.p + (p2.p - p1.p) * lv
          const y = yOfP(price)
          ctx.strokeStyle = lv === 0 || lv === 1 ? `${C.acc}aa` : `${C.acc}55`
          ctx.setLineDash(lv === 0.5 ? [3, 3] : [])
          ctx.beginPath()
          ctx.moveTo(xa, y)
          ctx.lineTo(xb + 26, y)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = `${C.acc}dd`
          ctx.fillText(`${lv.toFixed(3)}  ${fmtChartPrice(price)}`, xa + 4, y - 6)
        }
        dot(pts[0]); dot(pts[1])
      }
    }
    const dot = (pt: { x: number; y: number }) => {
      ctx.fillStyle = C.acc
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
    function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      c.beginPath()
      c.moveTo(x + r, y)
      c.arcTo(x + w, y, x + w, y + h, r)
      c.arcTo(x + w, y + h, x, y + h, r)
      c.arcTo(x, y + h, x, y, r)
      c.arcTo(x, y, x + w, y, r)
      c.closePath()
    }

    for (const d of drawingsRef.current) {
      strokeDrawing(d, ms.hoverId === d.id)
    }

    // предпросмотр рисования
    if (ms.mode === 'draw2' && ms.pending) {
      const p2 = { t: tOfX(ms.x), p: pOfY(ms.y) }
      const preview: ChartDrawing = {
        id: 'preview',
        type: (TWO_POINT.includes(toolRef.current as DrawType) ? toolRef.current : 'trend') as DrawType,
        points: [ms.pending, p2],
      }
      ctx.globalAlpha = 0.7
      strokeDrawing(preview, false)
      ctx.globalAlpha = 1
    }

    // ── Линейка ────────────────────────────────────────────────────
    const r = rulerRef.current
    const rulerLive = ms.mode === 'ruler' && ms.pending
      ? { t1: ms.pending.t, p1: ms.pending.p, t2: tOfX(ms.x), p2: pOfY(ms.y) }
      : r
    if (rulerLive) {
      const x1 = xOfT(rulerLive.t1), y1 = yOfP(rulerLive.p1)
      const x2 = xOfT(rulerLive.t2), y2 = yOfP(rulerLive.p2)
      const up = rulerLive.p2 >= rulerLive.p1
      const col = up ? C.pos : C.neg
      const rx = Math.min(x1, x2), ry = Math.min(y1, y2)
      const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1)
      ctx.fillStyle = up ? `${C.pos}18` : `${C.neg}18`
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeStyle = col
      ctx.lineWidth = 1.5
      ctx.strokeRect(rx, ry, rw, rh)
      // подпись
      const dP = rulerLive.p2 - rulerLive.p1
      const dPct = rulerLive.p1 > 0 ? (dP / rulerLive.p1) * 100 : 0
      const bars = Math.abs(Math.round((rulerLive.t2 - rulerLive.t1) / intervalMs))
      const lines = [
        `${dP >= 0 ? '+' : ''}${fmtChartPrice(dP)}  (${dPct >= 0 ? '+' : ''}${dPct.toFixed(2)}%)`,
        `${bars} бар(ов) · ${fmtDuration(Math.abs(rulerLive.t2 - rulerLive.t1))}`,
      ]
      ctx.font = 'bold 10px ui-monospace, Menlo, monospace'
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14
      const bx = clamp(x2 + 10, padL, padL + plotW - bw - 4)
      const by = clamp(y2 - 40, padT + 4, padT + fullH - 40)
      ctx.fillStyle = C.card
      roundRect(ctx, bx, by, bw, 36, 6)
      ctx.fill()
      ctx.strokeStyle = col
      ctx.lineWidth = 1
      roundRect(ctx, bx, by, bw, 36, 6)
      ctx.stroke()
      ctx.fillStyle = col
      ctx.textAlign = 'left'
      ctx.fillText(lines[0], bx + 7, by + 11)
      ctx.fillStyle = C.muted
      ctx.fillText(lines[1], bx + 7, by + 25)
    }

    // ── Кроссхэйр ──────────────────────────────────────────────────
    if (ms.inside && ms.x > padL && ms.x < padL + plotW && ms.y > padT && ms.y < padT + fullH) {
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = `${C.muted}88`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(Math.round(ms.x) + 0.5, padT)
      ctx.lineTo(Math.round(ms.x) + 0.5, padT + fullH)
      ctx.moveTo(padL, Math.round(ms.y) + 0.5)
      ctx.lineTo(padL + plotW, Math.round(ms.y) + 0.5)
      ctx.stroke()
      ctx.setLineDash([])
      // чип цены
      const cpTxt = fmtChartPrice(pOfY(ms.y))
      ctx.font = 'bold 10px ui-monospace, Menlo, monospace'
      const cw = ctx.measureText(cpTxt).width + 10
      ctx.fillStyle = C.muted
      roundRect(ctx, padL + plotW + 2, ms.y - 8, Math.min(cw, padR - 4), 16, 4)
      ctx.fill()
      ctx.fillStyle = '#0b0e17'
      ctx.textAlign = 'left'
      ctx.fillText(cpTxt, padL + plotW + 7, ms.y)
      // чип времени
      const ctTxt = fmtAxisTime(tOfX(ms.x), interval)
      const tw2 = ctx.measureText(ctTxt).width + 10
      ctx.fillStyle = C.muted
      roundRect(ctx, clamp(ms.x - tw2 / 2, padL, padL + plotW - tw2), padT + fullH + 2, tw2, 15, 4)
      ctx.fill()
      ctx.fillStyle = '#0b0e17'
      ctx.textAlign = 'center'
      ctx.fillText(ctTxt, clamp(ms.x, padL + tw2 / 2, padL + plotW - tw2 / 2), padT + fullH + 10)
    }
  }, [geom, interval, livePrice, readColors, showVolume])

  // ── Хит-тест рисунка под курсором ─────────────────────────────────
  const hitTest = useCallback((x: number, y: number): string | null => {
    const cs = candlesRef.current
    if (!cs || cs.length < 2 || !chartKey) return null
    const intervalMs = cs[1].t - cs[0].t || 60_000
    const view = viewRef.current
    const len = cs.length
    const rightIdx = clamp(len - view.offset, Math.max(5, view.bars * 0.35), len + view.bars * 0.35)
    const startIdx = rightIdx - view.bars
    const { padL, plotW, chartH, fullH } = geom()
    const barW = plotW / view.bars
    void fullH
    let minP = Infinity, maxP = -Infinity
    const i0 = Math.max(0, Math.floor(startIdx)), i1 = Math.min(len - 1, Math.ceil(rightIdx))
    for (let i = i0; i <= i1; i++) {
      if (cs[i].l < minP) minP = cs[i].l
      if (cs[i].h > maxP) maxP = cs[i].h
    }
    const padP = (maxP - minP) * 0.07 || 1
    minP -= padP; maxP += padP
    const yOfP = (p: number) => 10 + ((maxP - p) / (maxP - minP)) * chartH
    const xOfT = (t: number) => padL + ((t - cs[0].t) / intervalMs - startIdx + 0.5) * barW

    const near = (ax: number, ay: number, bx: number, by: number): boolean => {
      const dx = bx - ax, dy = by - ay
      const l2 = dx * dx + dy * dy
      if (l2 === 0) return Math.hypot(x - ax, y - ay) < 7
      let t = ((x - ax) * dx + (y - ay) * dy) / l2
      t = clamp(t, 0, 1)
      return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < 7
    }

    for (const d of drawingsRef.current) {
      const pts = d.points.map((pt) => ({ x: xOfT(pt.t), y: yOfP(pt.p) }))
      if (d.type === 'trend' && pts.length >= 2) {
        if (near(pts[0].x, pts[0].y, pts[1].x, pts[1].y)) return d.id
      } else if (d.type === 'hline' && pts.length >= 1) {
        if (near(padL, pts[0].y, padL + plotW, pts[0].y)) return d.id
      } else if (d.type === 'vline' && pts.length >= 1) {
        if (near(pts[0].x, 10, pts[0].x, 10 + fullH)) return d.id
      } else if (d.type === 'rect' && pts.length >= 2) {
        const x1 = Math.min(pts[0].x, pts[1].x), x2 = Math.max(pts[0].x, pts[1].x)
        const y1 = Math.min(pts[0].y, pts[1].y), y2 = Math.max(pts[0].y, pts[1].y)
        if (near(x1, y1, x2, y1) || near(x1, y2, x2, y2) || near(x1, y1, x1, y2) || near(x2, y1, x2, y2)) return d.id
      } else if (d.type === 'fib' && pts.length >= 2) {
        if (near(pts[0].x, pts[0].y, pts[1].x, pts[1].y)) return d.id
      }
    }
    return null
  }, [chartKey, geom])

  // ── Загрузка рисунков при смене ключа ─────────────────────────────
  const redrawRef = useRef(redraw)
  useEffect(() => { redrawRef.current = redraw }, [redraw])

  useEffect(() => {
    if (chartKey) {
      drawingsRef.current = loadDrawings(chartKey)
      rulerRef.current = null
    } else {
      drawingsRef.current = []
    }
    viewRef.current = { bars: 130, offset: 0 }
    redrawRef.current()
  }, [chartKey])

  // перерисовка при новых данных / теме / цене
  useEffect(() => { redrawRef.current() }, [candles, theme, livePrice])

  // внешняя очистка рисовалок (кнопка «корзина»)
  const firstClear = useRef(true)
  useEffect(() => {
    if (firstClear.current) {
      firstClear.current = false
      return
    }
    drawingsRef.current = []
    rulerRef.current = null
    redrawRef.current()
  }, [clearTick])

  // ресайз
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect()
      sizeRef.current = { w: r.width, h: r.height }
      redrawRef.current()
    })
    ro.observe(wrap)
    const r = wrap.getBoundingClientRect()
    sizeRef.current = { w: r.width, h: r.height }
    redrawRef.current()
    return () => ro.disconnect()
  }, [])

  // Esc — отмена рисования / линейка / курсор
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const ms = mouseRef.current
      if (ms.mode === 'draw2') {
        ms.mode = 'idle'
        ms.pending = undefined
        onToolDone?.()
        redrawRef.current()
      } else if (rulerRef.current || ms.mode === 'ruler') {
        rulerRef.current = null
        ms.mode = 'idle'
        ms.pending = undefined
        redrawRef.current()
      } else if (toolRef.current !== 'cursor') {
        onToolDone?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onToolDone])

  // ── Обработчики мыши ──────────────────────────────────────────────
  const pos = (e: React.MouseEvent | MouseEvent) => {
    const cv = canvasRef.current!
    const r = cv.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    const ms = mouseRef.current
    const p = pos(e)
    ms.x = p.x
    ms.y = p.y
    ms.inside = true
    const cv = canvasRef.current
    if (!cv) return

    if (ms.mode === 'pan') {
      const view = viewRef.current
      const { plotW } = geom()
      const barW = plotW / view.bars
      view.offset = ms.startOffset + (p.x - ms.startX) / barW
    } else if (ms.mode === 'drag' && ms.grab) {
      const cs = candlesRef.current
      if (cs.length >= 2) {
        const intervalMs = cs[1].t - cs[0].t || 60_000
        const dIdx = (p.x - ms.startX) / (geom().plotW / viewRef.current.bars)
        const view = viewRef.current
        const len = cs.length
        const rightIdx = clamp(len - view.offset, Math.max(5, view.bars * 0.35), len + view.bars * 0.35)
        const startIdx = rightIdx - view.bars
        // цена под стартовой позицией мыши
        void startIdx
        const { chartH } = geom()
        let minP = Infinity, maxP = -Infinity
        const i0 = Math.max(0, Math.floor(startIdx)), i1 = Math.min(len - 1, Math.ceil(rightIdx))
        for (let i = i0; i <= i1; i++) { if (cs[i].l < minP) minP = cs[i].l; if (cs[i].h > maxP) maxP = cs[i].h }
        const padP = (maxP - minP) * 0.07 || 1
        minP -= padP; maxP += padP
        const pOfY = (y: number) => maxP - ((y - 10) / chartH) * (maxP - minP)
        const dPrice = pOfY(p.y) - ms.grab.priceStart
        const dTime = dIdx * intervalMs
        const target = drawingsRef.current.find((d) => d.id === ms.grab!.id)
        if (target) {
          target.points = ms.grab.orig.map((pt) => ({ t: pt.t + dTime, p: pt.p + dPrice }))
          if (chartKey) saveDrawings(chartKey, drawingsRef.current)
        }
      }
    } else if (ms.mode === 'idle') {
      ms.hoverId = hitTest(p.x, p.y) ?? undefined
      const t = toolRef.current
      cv.style.cursor = ms.hoverId ? 'pointer' : t === 'cursor' ? 'crosshair' : 'crosshair'
    }
    redraw()
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (!interactive) return
    const ms = mouseRef.current
    const p = pos(e)
    const cv = canvasRef.current
    if (!cv) return
    const cs = candlesRef.current
    if (!cs || cs.length < 2) return
    const intervalMs = cs[1].t - cs[0].t || 60_000
    const view = viewRef.current
    const len = cs.length
    const rightIdx = clamp(len - view.offset, Math.max(5, view.bars * 0.35), len + view.bars * 0.35)
    const startIdx = rightIdx - view.bars
    const { padL, plotW, chartH, fullH } = geom()
    const barW = plotW / view.bars
    void fullH
    let minP = Infinity, maxP = -Infinity
    const i0 = Math.max(0, Math.floor(startIdx)), i1 = Math.min(len - 1, Math.ceil(rightIdx))
    for (let i = i0; i <= i1; i++) { if (cs[i].l < minP) minP = cs[i].l; if (cs[i].h > maxP) maxP = cs[i].h }
    const padP = (maxP - minP) * 0.07 || 1
    minP -= padP; maxP += padP
    const pOfY = (y: number) => maxP - ((y - 10) / chartH) * (maxP - minP)
    const tOfX = (x: number) => cs[0].t + ((x - padL) / barW + startIdx - 0.5) * intervalMs
    const anchor = { t: tOfX(p.x), p: pOfY(p.y) }

    // средняя кнопка — линейка (колёсико)
    if (e.button === 1) {
      e.preventDefault()
      ms.mode = 'ruler'
      ms.pending = anchor
      redraw()
      return
    }
    // правая кнопка — удалить рисунок под курсором
    if (e.button === 2) {
      const id = hitTest(p.x, p.y)
      if (id) {
        drawingsRef.current = drawingsRef.current.filter((d) => d.id !== id)
        if (chartKey) saveDrawings(chartKey, drawingsRef.current)
        redraw()
      }
      return
    }
    if (e.button !== 0) return

    const t = toolRef.current
    if (t === 'cursor') {
      const id = hitTest(p.x, p.y)
      if (id && chartKey) {
        const target = drawingsRef.current.find((d) => d.id === id)
        if (target) {
          ms.mode = 'drag'
          ms.grab = { id, orig: target.points.map((pt) => ({ ...pt })), idxStart: (anchor.t - cs[0].t) / intervalMs, priceStart: anchor.p }
          ms.startX = p.x
          ms.startY = p.y
        }
      } else {
        ms.mode = 'pan'
        ms.startX = p.x
        ms.startY = p.y
        ms.startOffset = view.offset
        cv.style.cursor = 'grabbing'
      }
      redraw()
      return
    }
    if (t === 'ruler') {
      if (ms.mode === 'draw2' && ms.pending) {
        rulerRef.current = { t1: ms.pending.t, p1: ms.pending.p, t2: anchor.t, p2: anchor.p }
        ms.mode = 'idle'
        ms.pending = undefined
        onToolDone?.()
      } else {
        ms.mode = 'draw2'
        ms.pending = anchor
      }
      redraw()
      return
    }
    if (t === 'hline' || t === 'vline') {
      if (chartKey) {
        drawId += 1
        drawingsRef.current = [...drawingsRef.current, { id: `d${Date.now()}_${drawId}`, type: t, points: [anchor] }]
        saveDrawings(chartKey, drawingsRef.current)
      }
      onToolDone?.()
      redraw()
      return
    }
    // двухточечные: тренд / прямоугольник / фибо
    if (ms.mode === 'draw2' && ms.pending) {
      if (chartKey) {
        drawId += 1
        drawingsRef.current = [...drawingsRef.current, { id: `d${Date.now()}_${drawId}`, type: t as DrawType, points: [ms.pending, anchor] }]
        saveDrawings(chartKey, drawingsRef.current)
      }
      ms.mode = 'idle'
      ms.pending = undefined
      onToolDone?.()
    } else {
      ms.mode = 'draw2'
      ms.pending = anchor
    }
    redraw()
  }

  const onMouseUp = () => {
    const ms = mouseRef.current
    if (ms.mode === 'ruler' && ms.pending) {
      // линейка колёсиком: фиксируем и оставляем до Esc/следующего замера
      rulerRef.current = { t1: ms.pending.t, p1: ms.pending.p, t2: ms.x ? tOfXFromState(ms.x) : ms.pending.t, p2: pOfYFromState(ms.y) }
      ms.pending = undefined
      ms.mode = 'idle'
    } else if (ms.mode === 'pan' || ms.mode === 'drag') {
      ms.mode = 'idle'
      ms.grab = undefined
      const cv = canvasRef.current
      if (cv) cv.style.cursor = 'crosshair'
    }
    redraw()
  }

  // хелперы цены/времени под курсором (для фиксирования линейки)
  function pOfYFromState(y: number): number {
    const cs = candlesRef.current
    if (!cs || cs.length < 2) return 0
    const view = viewRef.current
    const len = cs.length
    const rightIdx = clamp(len - view.offset, Math.max(5, view.bars * 0.35), len + view.bars * 0.35)
    const startIdx = rightIdx - view.bars
    const { chartH } = geom()
    let minP = Infinity, maxP = -Infinity
    const i0 = Math.max(0, Math.floor(startIdx)), i1 = Math.min(len - 1, Math.ceil(rightIdx))
    for (let i = i0; i <= i1; i++) { if (cs[i].l < minP) minP = cs[i].l; if (cs[i].h > maxP) maxP = cs[i].h }
    const padP = (maxP - minP) * 0.07 || 1
    minP -= padP; maxP += padP
    return maxP - ((y - 10) / chartH) * (maxP - minP)
  }
  function tOfXFromState(x: number): number {
    const cs = candlesRef.current
    if (!cs || cs.length < 2) return Date.now()
    const intervalMs = cs[1].t - cs[0].t || 60_000
    const view = viewRef.current
    const len = cs.length
    const rightIdx = clamp(len - view.offset, Math.max(5, view.bars * 0.35), len + view.bars * 0.35)
    const startIdx = rightIdx - view.bars
    const { padL, plotW } = geom()
    const barW = plotW / view.bars
    return cs[0].t + ((x - padL) / barW + startIdx - 0.5) * intervalMs
  }

  const onWheelNative = useCallback((e: WheelEvent) => {
    if (!interactive) return
    e.preventDefault()
    const cs = candlesRef.current
    if (!cs || cs.length < 2) return
    const view = viewRef.current
    const { padL, plotW } = geom()
    const cv = canvasRef.current
    if (!cv) return
    const r = cv.getBoundingClientRect()
    const px = e.clientX - r.left
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15
    const oldBars = view.bars
    const newBars = clamp(oldBars * factor, 15, Math.max(60, cs.length + 40))
    // якорь: индекс под курсором остаётся на месте
    const len = cs.length
    const oldRight = clamp(len - view.offset, Math.max(5, oldBars * 0.35), len + oldBars * 0.35)
    const oldStart = oldRight - oldBars
    const anchorIdx = oldStart + ((px - padL) / plotW) * oldBars
    const newRight = anchorIdx + (1 - (px - padL) / plotW) * newBars
    view.bars = newBars
    view.offset = len - newRight
    redrawRef.current()
  }, [geom, interactive])

  // нативный non-passive wheel: зум колесом без прокрутки страницы
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    cv.addEventListener('wheel', onWheelNative, { passive: false })
    return () => cv.removeEventListener('wheel', onWheelNative)
  }, [onWheelNative])

  const onDoubleClick = () => {
    viewRef.current = { bars: 130, offset: 0 }
    redraw()
  }

  const onLeave = () => {
    const ms = mouseRef.current
    ms.inside = false
    // драг/линейка завершились вне канваса — фиксируем
    if (ms.mode === 'ruler' && ms.pending) {
      rulerRef.current = { t1: ms.pending.t, p1: ms.pending.p, t2: tOfXFromState(ms.x), p2: pOfYFromState(ms.y) }
      ms.pending = undefined
      ms.mode = 'idle'
    } else if (ms.mode === 'pan' || ms.mode === 'drag') {
      ms.mode = 'idle'
      ms.grab = undefined
      const cv = canvasRef.current
      if (cv) cv.style.cursor = 'crosshair'
    }
    redraw()
  }

  return (
    <div ref={wrapRef} className={cn('relative h-full w-full', className)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ touchAction: 'none' }}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onLeave}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}
