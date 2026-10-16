// ════════════════════════════════════════════════════════════════════
// Телеметрия market-сервиса: CPU по ядрам, event loop, память
// ════════════════════════════════════════════════════════════════════

import os from 'os'
import type { ServiceStats } from './types'

const APP_VERSION = '3.5.0'

let lastCpu = os.cpus().map((c) => c.times)
let cpuLoadPct: number[] = []
let eventLoopLagMs = 0
let lastLagCheck = Date.now()

// измерение задержки event loop
setInterval(() => {
  const expected = 1000
  const now = Date.now()
  const drift = now - lastLagCheck - expected
  lastLagCheck = now
  const sample = Math.max(0, drift)
  eventLoopLagMs = eventLoopLagMs === 0 ? sample : eventLoopLagMs * 0.7 + sample * 0.3
}, 1000)

// загрузка CPU по ядрам
setInterval(() => {
  const cpus = os.cpus()
  cpuLoadPct = cpus.map((c, i) => {
    const prev = lastCpu[i] ?? c.times
    const totalPrev = prev.user + prev.nice + prev.sys + prev.idle + prev.irq
    const totalNow = c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq
    const idleDelta = c.times.idle - prev.idle
    const totalDelta = totalNow - totalPrev
    if (totalDelta <= 0) return 0
    return Math.min(100, Math.max(0, ((totalDelta - idleDelta) / totalDelta) * 100))
  })
  lastCpu = cpus.map((c) => ({ ...c.times }))
}, 5000)

export function collectStats(base: Omit<ServiceStats, 'sys'>): ServiceStats {
  const mem = process.memoryUsage()
  return {
    ...base,
    sys: {
      appVersion: APP_VERSION,
      nodeVersion: typeof Bun !== 'undefined' ? `Bun ${Bun.version}` : process.version,
      platform: `${os.platform()} ${os.arch()}`,
      cpuModel: os.cpus()[0]?.model ?? 'unknown',
      cpuCores: os.cpus().length,
      cpuLoadPct: cpuLoadPct.map((x) => Math.round(x * 10) / 10),
      loadAvg: os.loadavg().map((x) => Math.round(x * 100) / 100),
      eventLoopLagMs: Math.round(eventLoopLagMs * 100) / 100,
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      systemMemTotal: os.totalmem(),
      systemMemFree: os.freemem(),
      processPid: process.pid,
      uptime: Math.round(process.uptime()),
      serverTime: new Date().toISOString(),
    },
  }
}
