import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { sendCodeEmail, smtpConfigured } from '@/lib/mailer'

// ════════════════════════════════════════════════════════════════════
// Код подтверждения почты при регистрации.
// POST — выдать код на email (не чаще 1 в минуту, живёт 10 минут).
// ════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

const CODE_TTL_MS = 10 * 60_000
const RESEND_COOLDOWN_MS = 60_000

function hashCode(email: string, code: string): string {
  return createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret-change-me')
    .update(`${email}:${code}`)
    .digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Введите корректный email' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким email уже зарегистрирован' }, { status: 409 })
    }

    // антиспам: не чаще одного кода в минуту
    const recent = await db.verifyCode.findFirst({
      where: { email, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    })
    if (recent) {
      const wait = Math.ceil((recent.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000)
      return NextResponse.json({ error: `Код уже отправлен — запросите новый через ${wait} с` }, { status: 429 })
    }

    // чистим просроченные коды этого email
    await db.verifyCode.deleteMany({ where: { email } })

    const code = String(Math.floor(100000 + Math.random() * 900000))
    await db.verifyCode.create({
      data: {
        email,
        codeHash: hashCode(email, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    })

    const sent = await sendCodeEmail(email, code)

    // dev-режим без SMTP: возвращаем код, чтобы регистрация работала
    if (!sent && !smtpConfigured()) {
      console.log(`[auth] код для ${email}: ${code} (SMTP не настроен — dev-режим)`)
      return NextResponse.json({ ok: true, devCode: code, smtp: false })
    }
    if (!sent) {
      return NextResponse.json({ error: 'Не удалось отправить письмо, попробуйте позже' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, smtp: true })
  } catch (e) {
    console.error('code request error', e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
