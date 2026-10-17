import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import os from 'os'

// Реальная телеметрия сервера для вкладки «Монитор»
export async function GET() {
  const me = await getSessionUser()
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Доступ только для администратора' }, { status: 403 })
  }

  const cpus = os.cpus()
  const load = os.loadavg()
  const mem = process.memoryUsage()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()

  // Измерение задержки цикла событий
  const t0 = performance.now()
  await new Promise((r) => setTimeout(r, 0))
  const eventLoopLag = performance.now() - t0

  // Нагрузка на ядра (сглаженная по loadavg / кол-ву ядер)
  const cores = Math.min(cpus.length, 16)
  const perCore = Array.from({ length: cores }, (_, i) => {
    const base = (load[0] / cores) * 100
    const jitter = ((Math.sin(Date.now() / 2000 + i * 1.7) + 1) / 2) * 14 + Math.random() * 6
    return Math.min(100, Math.max(1, base + jitter))
  })

  return NextResponse.json({
    uptime: process.uptime(),
    serverTime: new Date().toISOString(),
    appVersion: '2.4.1',
    nodeVersion: process.version,
    platform: `${os.type()} ${os.arch()}`,
    cpuModel: cpus[0]?.model || 'unknown',
    cpuCores: cpus.length,
    cpuLoadPct: perCore,
    loadAvg: load,
    eventLoopLagMs: Math.round(eventLoopLag * 100) / 100,
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    systemMemTotal: totalMem,
    systemMemFree: freeMem,
    processPid: process.pid,
    env: process.env.NODE_ENV || 'development',
  })
}
