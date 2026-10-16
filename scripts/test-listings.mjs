// Проверка listings-событий market-сервиса
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003', { transports: ['websocket'] })

socket.on('connect', () => {
  console.log('connected:', socket.id)
})

socket.on('hello', (d) => {
  const listings = d.listings ?? []
  console.log('hello: symbols=', d.symbols, 'news=', d.news?.length, 'listings=', listings.length)
  for (const l of listings.slice(0, 12)) {
    console.log(` [${l.kind.toUpperCase()}] ${l.ex} ${l.m} · ${(l.symbols ?? []).join(',') || '—'} · src=${l.source} · ${new Date(l.time).toISOString().slice(0, 16)} · ${l.title.slice(0, 80)}`)
  }
  setTimeout(() => { console.log('done'); process.exit(0) }, 1500)
})

socket.on('listings:new', (fresh) => {
  console.log('LIVE NEW:', JSON.stringify(fresh).slice(0, 300))
})

setTimeout(() => { console.log('timeout exit'); process.exit(1) }, 12_000)
