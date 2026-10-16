import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = String(body.name || '').trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Введите корректный email' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не менее 6 символов' }, { status: 400 })
    }
    if (name.length < 2) {
      return NextResponse.json({ error: 'Введите имя (мин. 2 символа)' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким email уже зарегистрирован' }, { status: 409 })
    }

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
