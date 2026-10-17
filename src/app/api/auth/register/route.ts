import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { hashPassword, setSessionCookie } from '@/lib/auth'

// ════════════════════════════════════════════════════════════════════
// Регистрация: email + пароль + код подтверждения из письма.
// ════════════════════════════════════════════════════════════════════

function hashCode(email: string, code: string): string {
  return createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret-change-me')
    .update(`${email}:${code}`)
    .digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = String(body.name || '').trim()
    const code = String(body.code || '').trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Введите корректный email' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не менее 6 символов' }, { status: 400 })
    }
    if (name.length < 2) {
      return NextResponse.json({ error: 'Введите имя (мин. 2 символа)' }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Введите 6-значный код из письма' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким email уже зарегистрирован' }, { status: 409 })
    }

    // проверка кода
    const rec = await db.verifyCode.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    })
    if (!rec) {
      return NextResponse.json({ error: 'Сначала запросите код подтверждения' }, { status: 400 })
    }
    if (rec.expiresAt.getTime() < Date.now()) {
      await db.verifyCode.deleteMany({ where: { email } })
      return NextResponse.json({ error: 'Код истёк — запросите новый' }, { status: 400 })
    }
    if (rec.attempts >= 6) {
      await db.verifyCode.deleteMany({ where: { email } })
      return NextResponse.json({ error: 'Слишком много попыток — запросите новый код' }, { status: 429 })
    }
    if (rec.codeHash !== hashCode(email, code)) {
      await db.verifyCode.update({ where: { id: rec.id }, data: { attempts: rec.attempts + 1 } })
      return NextResponse.json({ error: 'Неверный код подтверждения' }, { status: 400 })
    }

    // код верен — создаём аккаунт
    const count = await db.user.count()
    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(password),
        role: count === 0 ? 'ADMIN' : 'USER',
        lastLoginAt: new Date(),
      },
    })
    await db.verifyCode.deleteMany({ where: { email } })
    await setSessionCookie(user.id)

    return NextResponse.json({
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        status: user.status, avatarColor: user.avatarColor, avatarEmoji: user.avatarEmoji,
        createdAt: user.createdAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
    })
  } catch (e) {
    console.error('register error', e)
    return NextResponse.json({ error: 'Ошибка сервера при регистрации' }, { status: 500 })
  }
}
