import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  const me = await getSessionUser()
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Доступ только для администратора' }, { status: 403 })
  }
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, name: true, role: true, status: true,
      avatarColor: true, avatarEmoji: true, createdAt: true, lastLoginAt: true,
    },
  })
  return NextResponse.json({ users })
}

export async function PATCH(req: NextRequest) {
  const me = await getSessionUser()
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Доступ только для администратора' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const { id, role, status } = body
    if (!id) return NextResponse.json({ error: 'Не указан пользователь' }, { status: 400 })
    if (id === me.id && (role === 'USER' || status === 'BANNED')) {
      return NextResponse.json({ error: 'Нельзя понизить или заблокировать себя' }, { status: 400 })
    }
    const data: Record<string, string> = {}
    if (role && ['ADMIN', 'USER'].includes(role)) data.role = role
    if (status && ['ACTIVE', 'BANNED'].includes(status)) data.status = status
    const user = await db.user.update({ where: { id }, data })
    return NextResponse.json({
      user: { ...user, createdAt: user.createdAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null },
    })
  } catch (e) {
    console.error('users patch error', e)
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const me = await getSessionUser()
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Доступ только для администратора' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Не указан пользователь' }, { status: 400 })
  if (id === me.id) return NextResponse.json({ error: 'Нельзя удалить себя' }, { status: 400 })
  await db.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
