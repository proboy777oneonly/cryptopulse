'use client'

import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, CheckCircle2, Cpu, Database, Gauge, HardDrive, MemoryStick, PlayCircle,
  Server, Timer, Users2, Wifi, XCircle, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLive } from '@/stores/live-store'
import { EX_MAP, fmtUptime } from '@/engines/types'
import { EmptyState, StatCard, useUptime } from '@/components/ui-bits'
import { cn } from '@/lib/utils'

function fmtBytes(v: number): string {
  const a = Math.abs(v)
  if (a >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(2)} ГБ`
  if (a >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)} МБ`
  if (a >= 1024) return `${(v / 1024).toFixed(0)} КБ`
  return `${v} Б`
}

interface TestResult {
  name: string
  ok: boolean
  detail: string
}

export function MonitorView() {
  const connects = useLive((s) => s.connects)
  const stats = useLive((s) => s.stats)
  const serviceStats = useLive((s) => s.serviceStats)
  const running = useLive((s) => s.running)
  const dataMode = useLive((s) => s.dataMode)
  const uptime = useUptime()
  const [tests, setTests] = useState<TestResult[] | null>(null)
  const [testing, setTesting] = useState(false)

  // телеметрия реального market-сервиса (порт 3003)
  const srv = serviceStats ? {
    uptime: serviceStats.sys.uptime,
    serverTime: serviceStats.sys.serverTime,
    appVersion: serviceStats.sys.appVersion,
    nodeVersion: serviceStats.sys.nodeVersion,
    platform: serviceStats.sys.platform,
    cpuModel: serviceStats.sys.cpuModel,
    cpuCores: serviceStats.sys.cpuCores,
    cpuLoadPct: serviceStats.sys.cpuLoadPct,
    loadAvg: serviceStats.sys.loadAvg,
    eventLoopLagMs: serviceStats.sys.eventLoopLagMs,
    rss: serviceStats.sys.rss,
    heapUsed: serviceStats.sys.heapUsed,
    heapTotal: serviceStats.sys.heapTotal,
    external: serviceStats.sys.external,
    systemMemTotal: serviceStats.sys.systemMemTotal,
    systemMemFree: serviceStats.sys.systemMemFree,
    processPid: serviceStats.sys.processPid,
    env: 'production',
  } : null

  const runTests = useCallback(async () => {
    setTesting(true)
    const results: TestResult[] = []
    // Market-сервер
    results.push({
      name: 'Market-сервер (реальные данные)',
      ok: dataMode === 'live',
      detail: dataMode === 'live' ? `socket подключён · ${serviceStats?.symbols ?? 0} символов` : dataMode === 'reconnecting' ? 'переподключение…' : 'нет соединения',
    })
    // API Next.js
    try {
      const r = await fetch('/api/server-stats')
      results.push({ name: 'API приложения', ok: r.ok, detail: r.ok ? 'Отвечает, 200 OK' : `Код ${r.status}` })
    } catch {
      results.push({ name: 'API приложения', ok: false, detail: 'Нет ответа' })
    }
    // Локальное хранилище
    try {
      localStorage.setItem('__cp_test', '1')
      localStorage.removeItem('__cp_test')
      results.push({ name: 'Локальное хранилище', ok: true, detail: 'Чтение и запись работают' })
    } catch {
      results.push({ name: 'Локальное хранилище', ok: false, detail: 'Доступ запрещён' })
    }
    // Аудио
    results.push({
      name: 'Звуковой движок',
      ok: typeof window.AudioContext !== 'undefined',
      detail: typeof window.AudioContext !== 'undefined' ? 'Web Audio доступен' : 'Web Audio недоступен',
    })
    // Голос
    results.push({
      name: 'Голосовой движок',
      ok: 'speechSynthesis' in window,
      detail: 'speechSynthesis' in window ? `${window.speechSynthesis.getVoices().length} голосов найдено` : 'Не поддерживается браузером',
    })
    // Движки
    results.push({ name: 'Движки скринера', ok: running, detail: running ? `Тик #${stats.ticks}, ошибок: ${stats.errors}` : 'Остановлены' })
    // Коннекты
    const online = connects.filter((c) => c.status === 'online').length
    results.push({ name: 'Коннекты бирж', ok: online >= 10, detail: `${online}/${connects.length} онлайн` })
    await new Promise((r) => setTimeout(r, 400))
    setTests(results)
    setTesting(false)
  }, [connects, dataMode, running, serviceStats, stats.ticks, stats.errors])

  const heapPct = srv ? (srv.heapUsed / srv.heapTotal) * 100 : 0
  const sysUsedPct = srv ? ((srv.systemMemTotal - srv.systemMemFree) / srv.systemMemTotal) * 100 : 0
  const booksTotal = connects.reduce((a, c) => a + c.booksTotal, 0)
  const booksLive = connects.reduce((a, c) => a + c.booksLive, 0)
  const avgLatency = connects.length > 0 ? connects.reduce((a, c) => a + c.latencyMs, 0) / connects.length : 0

  return (
    <div className="space-y-4">
      {/* Стат-карточки market-сервера */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Аптайм market-сервера" value={srv ? fmtUptime(srv.uptime) : '…'} sub={`сессия: ${uptime}`} icon={<Timer className="h-4 w-4" />} />
        <StatCard label="Версия" value={srv?.appVersion ?? '…'} sub={srv?.nodeVersion ?? ''} icon={<Server className="h-4 w-4" />} accent="#8b5cf6" />
        <StatCard label="Цикл событий" value={srv ? `${srv.eventLoopLagMs.toFixed(2)} мс` : '…'} sub="задержка event loop" icon={<Activity className="h-4 w-4" />} accent={srv && srv.eventLoopLagMs > 50 ? '#f43f5e' : '#10b981'} />
        <StatCard label="WS клиенты" value={serviceStats ? serviceStats.wsClients : '…'} sub="активных подключений" icon={<Wifi className="h-4 w-4" />} accent="#22d3ee" />
        <StatCard label="Книги (live/total)" value={`${booksLive}/${booksTotal}`} sub={`задержка ~${avgLatency.toFixed(0)} мс`} icon={<Database className="h-4 w-4" />} accent="#f59e0b" />
        <StatCard label="Символов в потоке" value={serviceStats ? serviceStats.symbols.toLocaleString('ru-RU') : '…'} sub={srv ? `${srv.cpuCores} ядер · ${srv.platform}` : ''} icon={<Cpu className="h-4 w-4" />} accent="#f472b6" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* CPU по ядрам */}
        <div className="cp-border-glow rounded-2xl bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Cpu className="h-4 w-4" style={{ color: 'var(--acc)' }} /> CPU · все ядра
          </h3>
          <div className="mt-2 truncate text-[11px] text-[var(--muted-foreground)]" title={srv?.cpuModel}>
            {srv?.cpuModel ?? '…'}
          </div>
          <div className="mt-3 space-y-1.5">
            {(srv?.cpuLoadPct ?? []).map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="cp-num w-6 text-[9px] font-bold text-[var(--muted-foreground)]">#{i + 1}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${Math.min(100, p)}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    style={{ background: p > 70 ? 'linear-gradient(90deg,#f59e0b,#f43f5e)' : 'linear-gradient(90deg, color-mix(in srgb, var(--acc) 50%, transparent), var(--acc))' }}
                  />
                </div>
                <span className="cp-num w-10 text-right text-[10px] font-bold">{p.toFixed(0)}%</span>
              </div>
            ))}
          </div>
          {srv && (
            <div className="cp-num mt-3 text-[10px] text-[var(--muted-foreground)]">
              load avg: {srv.loadAvg.map((l) => l.toFixed(2)).join(' · ')}
            </div>
          )}
        </div>

        {/* Память */}
        <div className="cp-border-glow rounded-2xl bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <MemoryStick className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Память
          </h3>
          <div className="mt-4 space-y-3.5">
            {[
              { label: 'RSS процесса', val: srv ? fmtBytes(srv.rss) : '…', pct: srv ? Math.min(100, (srv.rss / srv.systemMemTotal) * 100) : 0, icon: <HardDrive className="h-3.5 w-3.5" /> },
              { label: 'Heap (used/total)', val: srv ? `${fmtBytes(srv.heapUsed)} / ${fmtBytes(srv.heapTotal)}` : '…', pct: heapPct, icon: <Database className="h-3.5 w-3.5" /> },
              { label: 'External', val: srv ? fmtBytes(srv.external) : '…', pct: 8, icon: <Zap className="h-3.5 w-3.5" /> },
              { label: 'ОЗУ сервера', val: srv ? `${fmtBytes(srv.systemMemTotal - srv.systemMemFree)} / ${fmtBytes(srv.systemMemTotal)}` : '…', pct: sysUsedPct, icon: <Server className="h-3.5 w-3.5" /> },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-[var(--muted-foreground)]">{m.icon} {m.label}</span>
                  <span className="cp-num font-bold">{m.val}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${Math.min(100, m.pct)}%` }}
                    transition={{ duration: 1 }}
                    style={{ background: m.pct > 80 ? 'linear-gradient(90deg,#f59e0b,#f43f5e)' : 'linear-gradient(90deg, color-mix(in srgb, var(--pos) 45%, transparent), var(--pos))' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Движки + тесты */}
        <div className="cp-border-glow rounded-2xl bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Gauge className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Движки скринера
          </h3>
          <div className="mt-3 space-y-2">
            {[
              { name: 'Реальный поток (8 бирж, F+S)', count: stats.ticks, unit: 'тиков', color: '#8b5cf6' },
              { name: 'Плотности', count: stats.densities, unit: 'событий', color: '#f59e0b' },
              { name: 'Движения', count: stats.movements, unit: 'алертов', color: '#10b981' },
              { name: 'Арбитраж', count: stats.arbitrages, unit: 'сигналов', color: '#22d3ee' },
              { name: 'Новости', count: stats.news, unit: 'публикаций', color: '#f472b6' },
              ...(serviceStats ? [{ name: 'Стен найдено сервисом', count: serviceStats.walls, unit: 'шт', color: '#a78bfa' }] : []),
            ].map((e) => (
              <div key={e.name} className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2">
                <span className="h-2 w-2 rounded-full cp-pulse-dot" style={{ background: e.color }} />
                <span className="flex-1 truncate text-xs font-semibold">{e.name}</span>
                <span className="cp-num text-xs font-black" style={{ color: e.color }}>{e.count.toLocaleString('ru-RU')}</span>
                <span className="text-[9px] text-[var(--muted-foreground)]">{e.unit}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-xs">
              <span className="font-semibold">Ошибки движка</span>
              <span className="cp-num font-black" style={{ color: stats.errors > 0 ? '#f43f5e' : 'var(--pos)' }}>{stats.errors}</span>
            </div>
          </div>

          {/* Самотесты */}
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">Диагностика</span>
              <Button size="sm" variant="outline" onClick={runTests} disabled={testing}>
                <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> {testing ? 'Проверка…' : 'Запустить тесты'}
              </Button>
            </div>
            {tests && (
              <div className="mt-2 space-y-1">
                {tests.map((t, i) => (
                  <motion.div
                    key={t.name}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                    className="flex items-center gap-2 rounded-lg bg-[var(--muted)] px-2.5 py-1.5 text-[11px]"
                  >
                    {t.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--pos)' }} /> : <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--neg)' }} />}
                    <span className="font-semibold">{t.name}</span>
                    <span className="ml-auto truncate text-[10px] text-[var(--muted-foreground)]">{t.detail}</span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Коннекты */}
      <div className="cp-border-glow rounded-2xl bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Wifi className="h-4 w-4" style={{ color: 'var(--acc)' }} /> Коннекты · книги · стримы
          </h3>
          <span className="cp-num rounded-md bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold" style={{ color: 'var(--pos)' }}>
            {connects.filter((c) => c.status === 'online').length}/{connects.length} онлайн
          </span>
          <span className="ml-auto text-[11px] text-[var(--muted-foreground)]">
            {srv ? `PID ${srv.processPid} · ${srv.env}` : ''}
          </span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                <th className="pb-2 pl-2 font-bold">Биржа</th>
                <th className="pb-2 font-bold">Рынок</th>
                <th className="pb-2 font-bold">Статус</th>
                <th className="pb-2 text-right font-bold">Задержка</th>
                <th className="pb-2 text-right font-bold">Сообщ/сек</th>
                <th className="pb-2 text-right font-bold">Книги live/total</th>
                <th className="pb-2 pr-2 text-right font-bold">Аптайм</th>
              </tr>
            </thead>
            <tbody>
              {connects.map((c) => {
                const meta = EX_MAP[c.exchange]
                return (
                  <tr key={c.id} className="border-b border-[var(--border)]/50 transition-colors hover:bg-[var(--muted)]">
                    <td className="py-2 pl-2">
                      <span className="flex items-center gap-2 font-bold">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                        {meta.name}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-black" style={{ background: c.market === 'F' ? '#f59e0b1a' : '#22d3ee1a', color: c.market === 'F' ? '#f59e0b' : '#22d3ee' }}>
                        {c.market === 'F' ? 'FUTURES' : 'SPOT'}
                      </span>
                    </td>
                    <td className="py-2">
                      <span
                        className={cn('flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-black')}
                        style={
                          c.status === 'online'
                            ? { background: '#10b9811a', color: 'var(--pos)' }
                            : { background: '#f59e0b1a', color: '#f59e0b' }
                        }
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', c.status === 'online' && 'cp-pulse-dot')} style={{ background: c.status === 'online' ? 'var(--pos)' : '#f59e0b' }} />
                        {c.status === 'online' ? 'ПОДКЛЮЧЕНО' : 'ДЕГРАДАЦИЯ'}
                      </span>
                    </td>
                    <td className="cp-num py-2 text-right font-semibold" style={{ color: c.latencyMs > 40 ? '#f59e0b' : undefined }}>
                      {c.latencyMs.toFixed(0)} мс
                    </td>
                    <td className="cp-num py-2 text-right">{c.msgsPerSec.toFixed(0)}</td>
                    <td className="cp-num py-2 text-right">{c.booksLive}/{c.booksTotal}</td>
                    <td className="cp-num py-2 pr-2 text-right text-[var(--muted-foreground)]">{fmtUptime(c.uptime)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════ ПОЛЬЗОВАТЕЛИ (АДМИН) ═══════════════════════════

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  status: string
  avatarColor: string
  avatarEmoji: string
  createdAt: string
  lastLoginAt: string | null
}

export function UsersView() {
  const me = useLive((s) => 0)
  void me
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      const json = await res.json()
      if (res.ok) setUsers(json.users)
      else setError(json.error ?? 'Ошибка загрузки')
    } catch {
      setError('Сеть недоступна')
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  const patch = async (id: string, body: Record<string, string>) => {
    setBusy(id)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Ошибка')
        return
      }
      setError('')
      setUsers((prev) => prev?.map((u) => (u.id === id ? { ...u, ...body } : u)) ?? prev)
    } finally {
      setBusy('')
    }
  }

  const remove = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
      if (res.ok) setUsers((prev) => prev?.filter((u) => u.id !== id) ?? prev)
      else {
        const json = await res.json()
        setError(json.error ?? 'Ошибка удаления')
      }
    } finally {
      setBusy('')
    }
  }

  if (users === null) {
    return <div className="cp-border-glow rounded-2xl bg-card"><EmptyState icon={<Users2 className="h-10 w-10" />} title="Загрузка пользователей…" /></div>
  }

  const admins = users.filter((u) => u.role === 'ADMIN').length
  const banned = users.filter((u) => u.status === 'BANNED').length
  const weekAgo = Date.now() - 7 * 86400_000
  const fresh = users.filter((u) => new Date(u.createdAt).getTime() > weekAgo).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Всего пользователей" value={users.length} icon={<Users2 className="h-4 w-4" />} />
        <StatCard label="Администраторы" value={admins} icon={<Server className="h-4 w-4" />} accent="#f59e0b" />
        <StatCard label="Заблокированы" value={banned} icon={<XCircle className="h-4 w-4" />} accent="#f43f5e" />
        <StatCard label="Новые за неделю" value={fresh} icon={<Activity className="h-4 w-4" />} accent="#10b981" />
      </div>

      {error && (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--destructive)_40%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_8%,transparent)] px-4 py-3 text-xs font-semibold text-[var(--destructive)]">
          {error}
        </div>
      )}

      <div className="cp-border-glow overflow-x-auto rounded-2xl bg-card p-5">
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              <th className="pb-2 pl-2 font-bold">Пользователь</th>
              <th className="pb-2 font-bold">Роль</th>
              <th className="pb-2 font-bold">Регистрация</th>
              <th className="pb-2 font-bold">Последний вход</th>
              <th className="pb-2 font-bold">Статус</th>
              <th className="pb-2 pr-2 text-right font-bold">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={cn('border-b border-[var(--border)]/50 transition-colors hover:bg-[var(--muted)]', u.status === 'BANNED' && 'opacity-50')}>
                <td className="py-2.5 pl-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                      style={{ background: `linear-gradient(135deg, ${u.avatarColor === 'violet' ? '#8b5cf6' : u.avatarColor === 'amber' ? '#f59e0b' : u.avatarColor === 'emerald' ? '#10b981' : '#06b6d4'}, #0002)` }}
                    >
                      {u.avatarEmoji}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-bold">{u.name}</div>
                      <div className="truncate text-[10px] text-[var(--muted-foreground)]">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5">
                  <span
                    className="rounded-md px-2 py-0.5 text-[9px] font-black tracking-wider"
                    style={u.role === 'ADMIN'
                      ? { background: '#f59e0b1a', color: '#f59e0b' }
                      : { background: 'color-mix(in srgb, var(--acc) 12%, transparent)', color: 'var(--acc)' }}
                  >
                    {u.role === 'ADMIN' ? 'АДМИН' : 'ТРЕЙДЕР'}
                  </span>
                </td>
                <td className="cp-num py-2.5 text-[var(--muted-foreground)]">{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                <td className="cp-num py-2.5 text-[var(--muted-foreground)]">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="py-2.5">
                  <span className="font-bold" style={{ color: u.status === 'BANNED' ? 'var(--neg)' : 'var(--pos)' }}>
                    {u.status === 'BANNED' ? 'БЛОК' : 'АКТИВЕН'}
                  </span>
                </td>
                <td className="py-2.5 pr-2">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm" variant="outline" className="h-7 px-2 text-[10px]"
                      disabled={busy === u.id}
                      onClick={() => patch(u.id, { role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
                    >
                      {u.role === 'ADMIN' ? '→ трейдер' : '→ админ'}
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-7 px-2 text-[10px]"
                      disabled={busy === u.id}
                      onClick={() => patch(u.id, { status: u.status === 'BANNED' ? 'ACTIVE' : 'BANNED' })}
                    >
                      {u.status === 'BANNED' ? 'разблок' : 'блок'}
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-7 px-2 text-[10px] text-[var(--destructive)]"
                      disabled={busy === u.id}
                      onClick={() => { if (window.confirm(`Удалить пользователя ${u.email}?`)) void remove(u.id) }}
                    >
                      удалить
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
