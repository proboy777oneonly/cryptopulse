// ─── Голосовые уведомления через SpeechSynthesis (ru-RU) ─────────────

class VoiceEngine {
  enabled = false
  voiceURI = ''
  rate = 1.05
  pitch = 1
  volume = 0.9
  private queue: string[] = []
  private speaking = false
  private voices: SpeechSynthesisVoice[] = []

  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  refreshVoices(cb?: (voices: SpeechSynthesisVoice[]) => void) {
    if (!this.supported) return
    const load = () => {
      this.voices = window.speechSynthesis.getVoices()
      cb?.(this.voices)
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices
  }

  russianVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter((v) => v.lang.toLowerCase().startsWith('ru'))
  }

  speak(text: string) {
    if (!this.enabled || !this.supported || !text) return
    this.queue.push(text)
    if (this.queue.length > 5) this.queue = this.queue.slice(-5)
    void this.pump()
  }

  private async pump() {
    if (this.speaking) return
    this.speaking = true
    try {
      while (this.queue.length > 0) {
        const text = this.queue.shift()!
        await new Promise<void>((resolve) => {
          try {
            const u = new SpeechSynthesisUtterance(text)
            const rv = this.russianVoices()
            const chosen = rv.find((v) => v.voiceURI === this.voiceURI) ?? rv[0]
            if (chosen) u.voice = chosen
            u.lang = chosen?.lang ?? 'ru-RU'
            u.rate = this.rate
            u.pitch = this.pitch
            u.volume = this.volume
            u.onend = () => resolve()
            u.onerror = () => resolve()
            window.speechSynthesis.speak(u)
            // Страховка от зависшего utterance
            setTimeout(resolve, 12000)
          } catch {
            resolve()
          }
        })
      }
    } finally {
      this.speaking = false
    }
  }

  test(text = 'Голосовые уведомления активированы') {
    const wasEnabled = this.enabled
    this.enabled = true
    this.speak(text)
    this.enabled = wasEnabled
  }

  stop() {
    this.queue = []
    if (this.supported) window.speechSynthesis.cancel()
  }
}

export const voiceEngine = new VoiceEngine()

// ─── Шаблоны озвучки ──────────────────────────────────────────────────

export function voiceTextDensity(symbol: string, volumeUsd: number, side: 'BID' | 'ASK', exchange: string): string {
  const vol = volumeUsd >= 1e9 ? `${(volumeUsd / 1e9).toFixed(1)} миллиарда` : `${Math.round(volumeUsd / 1e6)} миллионов`
  return `${symbol}. Плотность ${side === 'BID' ? 'покупателей' : 'продавцов'}, ${vol} долларов, ${exchange}`
}

export function voiceTextMovement(symbol: string, pct: number, exchange: string): string {
  const p = Math.abs(pct)
  const whole = p >= 10 ? Math.round(p) : Math.round(p * 10) / 10
  return `${symbol}. ${pct > 0 ? 'рост' : 'падение'} ${whole} процентов, ${exchange}`
}

export function voiceTextArbitrage(symbol: string, spreadPct: number): string {
  return `Арбитраж ${symbol}. Спред ${spreadPct.toFixed(1)} процента`
}

export function voiceTextNews(title: string): string {
  return `Срочно. ${title}`
}
