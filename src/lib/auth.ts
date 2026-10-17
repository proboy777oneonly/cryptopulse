import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'
const COOKIE = 'cp_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 дней

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    const hashBuf = Buffer.from(hash, 'hex')
    const testBuf = scryptSync(password, salt, 64)
    return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf)
  } catch {
    return false
  }
}

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex')
}

export function createToken(userId: string): string {
  const exp = Date.now() + MAX_AGE * 1000
  const payload = `${userId}.${exp}`
  return `${payload}.${sign(payload)}`
}

export function parseToken(token: string | undefined): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, exp, sig] = parts
  if (sign(`${userId}.${exp}`) !== sig) return null
  if (Number(exp) < Date.now()) return null
  return userId
}

export async function setSessionCookie(userId: string) {
  const store = await cookies()
  store.set(COOKIE, createToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: MAX_AGE,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(COOKIE)
}

export interface SessionUser {
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

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies()
    const userId = parseToken(store.get(COOKIE)?.value)
    if (!userId) return null
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user || user.status === 'BANNED') return null
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarColor: user.avatarColor,
      avatarEmoji: user.avatarEmoji,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    }
  } catch {
    return null
  }
}
