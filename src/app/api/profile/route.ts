import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser, hashPassword, verifyPassword } from '@/lib/auth'

export async function PATCH(req: NextRequest) {
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  try {
    const body = await req.json()
    const data: Record<string, string> = {}

    if (typeof body.name === 'string' && body.name.trim().length >= 2) {
      data.name = body.name.trim()
    }
    if (typeof body.avatarColor === 'string') data.avatarColor = body.avatarColor
    if (typeof body.avatarEmoji === 'string' && body.avatarEmoji.length <= 4) data.avatarEmoji = body.avatarEmoji

    if (body.newPassword) {
      const user = await db.user.findUnique({ where: { id: me.id } })
      if (!user || !verifyPassword(String(body.currentPassword || ''), user.passwordHash)) {
        return NextResponse.json({ error: 'Текущий пароль неверен' }, { status: 400 })
      }
      if (String(body.newPassword).length < 6) {
        return NextResponse.json({ error: 'Новый пароль должен быть не менее 6 символов' }, { status: 400 })
      }
      data.passwordHash = hashPassword(String(body.newPassword))
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Нет изменений' }, { status: 400 })
    }

    const user = await db.user.update({ where: { id: me.id }, data })
    return NextResponse.json({
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        status: user.status, avatarColor: user.avatarColor, avatarEmoji: user.avatarEmoji,
        createdAt: user.createdAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      },
    })
  } catch (e) {
    console.error('profile patch error', e)
    return NextResponse.json({ error: 'Ошибка обновления профиля' }, { status: 500 })
  }
}
