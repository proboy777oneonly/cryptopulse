import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }
    if (user.status === 'BANNED') {
      return NextResponse.json({ error: 'Аккаунт заблокирован администратором' }, { status: 403 })
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    await setSessionCookie(user.id)

    return NextResponse.json({
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        status: user.status, avatarColor: user.avatarColor, avatarEmoji: user.avatarEmoji,
        createdAt: user.createdAt.toISOString(), lastLoginAt: new Date().toISOString(),
      },
    })
  } catch (e) {
    console.error('login error', e)
    return NextResponse.json({ error: 'Ошибка сервера при входе' }, { status: 500 })
  }
}
