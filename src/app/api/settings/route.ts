import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const settings = await db.settings.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ data: settings ? JSON.parse(settings.data) : null })
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  try {
    const body = await req.json()
    const json = JSON.stringify(body)
    if (json.length > 500_000) {
      return NextResponse.json({ error: 'Настройки слишком большие' }, { status: 413 })
    }
    await db.settings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, data: json },
      update: { data: json },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('settings save error', e)
    return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 })
  }
}
