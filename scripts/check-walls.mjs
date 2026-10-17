// Проверка потока стен: firstSeen присутствует, heartbeat приходит
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003/', { transports: ['websocket'] })
let wallCount = 0
let withFirstSeen = 0

setTimeout(() => {
  console.log(`walls received: ${wallCount}, with firstSeen: ${withFirstSeen}`)
  process.exit(0)
}, 20000)

socket.on('connect', () => console.log('connected to market-service'))
socket.on('walls', (rows) => {
  for (const w of rows) {
    wallCount++
    if (w.firstSeen) withFirstSeen++
  }
  if (wallCount <= 3) {
    const w = rows[0]
    console.log('sample wall:', w.symbol, w.side, '$' + Math.round(w.notionalUsd).toLocaleString(), '| firstSeen age:', w.firstSeen ? Math.round((Date.now() - w.firstSeen) / 1000) + 's' : 'MISSING')
  }
})
