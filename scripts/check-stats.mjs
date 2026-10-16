import { io } from 'socket.io-client'
const socket = io('http://localhost:3003', { transports: ['websocket'] })
const t = setTimeout(() => { console.log('timeout'); process.exit(1) }, 8000)
socket.on('stats', (d) => {
  clearTimeout(t)
  console.log('eventLoopLagMs:', d.sys.eventLoopLagMs)
  console.log('cpuLoadPct:', d.sys.cpuLoadPct.join(', '))
  console.log('loadAvg:', d.sys.loadAvg.join(', '))
  console.log('rss MB:', Math.round(d.sys.rss / 1e6), 'heap MB:', Math.round(d.sys.heapUsed / 1e6))
  console.log('symbols:', d.symbols, 'walls:', d.walls, 'movers:', d.movers)
  socket.close()
  process.exit(0)
})
