import nodemailer, { type Transporter } from 'nodemailer'

// ════════════════════════════════════════════════════════════════════
// Почтовый отправитель кодов подтверждения.
// Настраивается через SMTP_* в .env; без SMTP работает dev-режим
// (код возвращается в ответе API и показывается в интерфейсе).
// ════════════════════════════════════════════════════════════════════

let cached: Transporter | null | undefined

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT)
}

function getTransport(): Transporter | null {
  if (cached !== undefined) return cached
  if (!smtpConfigured()) {
    cached = null
    return cached
  }
  try {
    cached = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
    })
  } catch {
    cached = null
  }
  return cached
}

export async function sendCodeEmail(to: string, code: string): Promise<boolean> {
  const tr = getTransport()
  if (!tr) return false
  const from = process.env.SMTP_FROM ?? `"CryptoPulse" <${process.env.SMTP_USER ?? 'noreply@cryptopulse.local'}>`
  try {
    await tr.sendMail({
      from,
      to,
      subject: `Код подтверждения: ${code}`,
      text: `Ваш код подтверждения CryptoPulse: ${code}\nКод действует 10 минут.\nЕсли вы не запрашивали регистрацию — просто проигнорируйте это письмо.`,
      html: `
      <div style="background:#070b16;padding:36px 20px;font-family:'Segoe UI',Roboto,Arial,sans-serif">
        <div style="max-width:420px;margin:0 auto;background:#0d1220;border:1px solid #1e2638;border-radius:18px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#8b5cf6,#06b6d4);padding:22px 26px">
            <div style="color:#fff;font-size:19px;font-weight:800;letter-spacing:-0.02em">Crypto<span style="opacity:.85">Pulse</span></div>
            <div style="color:rgba(255,255,255,.75);font-size:11px;text-transform:uppercase;letter-spacing:.24em;margin-top:3px">screener pro</div>
          </div>
          <div style="padding:28px 26px">
            <div style="color:#e2e8f0;font-size:15px;font-weight:700">Подтверждение регистрации</div>
            <div style="color:#8b95ab;font-size:13px;line-height:1.55;margin-top:8px">
              Введите этот код на странице регистрации, чтобы завершить создание аккаунта.
            </div>
            <div style="margin:22px 0 6px;text-align:center;background:#111726;border:1px solid #2a3450;border-radius:12px;padding:14px">
              <span style="color:#fff;font-size:32px;font-weight:800;letter-spacing:.42em;font-family:'Courier New',monospace">${code}</span>
            </div>
            <div style="color:#67718a;font-size:11px;line-height:1.5">
              Код действует 10 минут. Если вы не запрашивали регистрацию — просто проигнорируйте это письмо.
            </div>
          </div>
        </div>
      </div>`,
    })
    return true
  } catch {
    return false
  }
}
