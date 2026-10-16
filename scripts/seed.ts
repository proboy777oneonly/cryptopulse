import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const db = new PrismaClient()

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  const email = 'admin@screen.io'
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log('admin already exists')
    return
  }
  await db.user.create({
    data: {
      email,
      name: 'Администратор',
      passwordHash: hashPassword('admin123'),
      role: 'ADMIN',
      avatarEmoji: '👑',
      avatarColor: 'amber',
    },
  })
  console.log('admin created:', email, '/ admin123')
}

main().finally(() => db.$disconnect())
