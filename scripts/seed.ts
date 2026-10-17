import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const db = new PrismaClient()

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

// Генератор читаемого случайного пароля (если ADMIN_PASSWORD не задан)
function randomPassword(): string {
  const words = ['orbit', 'delta', 'pulse', 'nova', 'vault', 'quanta', 'cipher', 'ember', 'flux', 'atlas']
  const pick = () => words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(10 + Math.random() * 89)
  return `${pick()}-${pick()}-${num}`
}

async function main() {
  // Кредиты берутся из переменных окружения (.env или ENV)
  const email = process.env.ADMIN_EMAIL?.trim() || 'admin@screen.io'
  let password = process.env.ADMIN_PASSWORD?.trim() || ''
  let generated = false
  if (!password) {
    password = randomPassword()
    generated = true
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`админ уже существует: ${email} (пароль не менялся)`)
    return
  }

  await db.user.create({
    data: {
      email,
      name: 'Администратор',
      passwordHash: hashPassword(password),
      role: 'ADMIN',
      avatarEmoji: '👑',
      avatarColor: 'amber',
    },
  })

  console.log('──────────────────────────────────────────────')
  console.log(`админ создан: ${email}`)
  if (generated) {
    console.log(`пароль (сгенерирован, сохраните его!): ${password}`)
    console.log('подсказка: задайте ADMIN_EMAIL / ADMIN_PASSWORD в .env,')
    console.log('чтобы контролировать кредиты при развёртывании')
  } else {
    console.log('пароль: взят из ADMIN_PASSWORD')
  }
  console.log('──────────────────────────────────────────────')
}

main().finally(() => db.$disconnect())
