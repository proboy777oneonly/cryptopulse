// ─── Звуковой движок: синтез звуков через Web Audio API ────────────────

export interface SoundDef {
  id: string
  name: string
  play: (ctx: AudioContext, out: GainNode, t0: number) => void
}

function tone(ctx: AudioContext, out: GainNode, t0: number, freq: number, dur: number, type: OscillatorType, peak = 0.5, delay = 0) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0 + delay)
  gain.gain.setValueAtTime(0.0001, t0 + delay)
  gain.gain.exponentialRampToValueAtTime(peak, t0 + delay + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur)
  osc.connect(gain).connect(out)
  osc.start(t0 + delay)
  osc.stop(t0 + delay + dur + 0.05)
}

export const SOUNDS: SoundDef[] = [
  {
    id: 'ding',
    name: 'Динь',
    play: (ctx, out, t0) => {
      tone(ctx, out, t0, 880, 0.45, 'sine', 0.5)
      tone(ctx, out, t0, 1318.5, 0.6, 'sine', 0.35, 0.06)
    },
  },
  {
    id: 'bell',
    name: 'Колокол',
    play: (ctx, out, t0) => {
      tone(ctx, out, t0, 587.3, 1.1, 'sine', 0.45)
      tone(ctx, out, t0, 880, 0.9, 'sine', 0.3, 0.02)
      tone(ctx, out, t0, 1174.7, 0.7, 'sine', 0.18, 0.04)
    },
  },
  {
    id: 'alert',
    name: 'Тревога',
    play: (ctx, out, t0) => {
      for (let i = 0; i < 3; i++) {
        tone(ctx, out, t0, 660, 0.14, 'square', 0.22, i * 0.22)
        tone(ctx, out, t0, 880, 0.14, 'square', 0.22, i * 0.22 + 0.1)
      }
    },
  },
  {
    id: 'blip',
    name: 'Блип',
    play: (ctx, out, t0) => {
      tone(ctx, out, t0, 1240, 0.09, 'triangle', 0.5)
      tone(ctx, out, t0, 1650, 0.08, 'triangle', 0.3, 0.07)
    },
  },
  {
    id: 'laser',
    name: 'Лазер',
    play: (ctx, out, t0) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(1400, t0)
      osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.35)
      gain.gain.setValueAtTime(0.35, t0)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38)
      osc.connect(gain).connect(out)
      osc.start(t0)
      osc.stop(t0 + 0.42)
    },
  },
  {
    id: 'chord',
    name: 'Аккорд',
    play: (ctx, out, t0) => {
      tone(ctx, out, t0, 523.3, 0.7, 'sine', 0.3)
      tone(ctx, out, t0, 659.3, 0.7, 'sine', 0.3, 0.08)
      tone(ctx, out, t0, 784, 0.8, 'sine', 0.3, 0.16)
      tone(ctx, out, t0, 1046.5, 0.9, 'sine', 0.25, 0.24)
    },
  },
  {
    id: 'power',
    name: 'Питание',
    play: (ctx, out, t0) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(180, t0)
      osc.frequency.exponentialRampToValueAtTime(720, t0 + 0.5)
      gain.gain.setValueAtTime(0.4, t0)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55)
      osc.connect(gain).connect(out)
      osc.start(t0)
      osc.stop(t0 + 0.6)
    },
  },
  {
    id: 'double',
    name: 'Двойной',
    play: (ctx, out, t0) => {
      tone(ctx, out, t0, 987.8, 0.12, 'sine', 0.5)
      tone(ctx, out, t0, 987.8, 0.25, 'sine', 0.5, 0.16)
    },
  },
]

export const SOUND_MAP: Record<string, SoundDef> = Object.fromEntries(SOUNDS.map((s) => [s.id, s]))

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  unlocked = false
  private lastPlayed = new Map<string, number>()

  unlock() {
    if (this.unlocked) return
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        this.ctx = new AC()
        this.master = this.ctx.createGain()
        this.master.connect(this.ctx.destination)
      }
      void this.ctx.resume()
      this.unlocked = true
    } catch {
      this.unlocked = false
    }
  }

  play(soundId: string, volumePct: number) {
    if (!this.unlocked || !this.ctx || !this.master) return
    const def = SOUND_MAP[soundId] ?? SOUND_MAP.ding
    // Не спамим одинаковым звуком чаще 2 раз в секунду
    const last = this.lastPlayed.get(soundId) ?? 0
    if (Date.now() - last < 450) return
    this.lastPlayed.set(soundId, Date.now())
    try {
      const vol = Math.min(Math.max(volumePct / 100, 0), 1) * 0.8
      def.play(this.ctx, this.master, this.ctx.currentTime + 0.01)
      this.master.gain.setValueAtTime(vol, this.ctx.currentTime)
    } catch {
      /* ignore */
    }
  }

  preview(soundId: string, volumePct: number) {
    this.unlock()
    // Прямой запуск с новой MASTER-громкостью
    if (!this.ctx || !this.master) return
    const def = SOUND_MAP[soundId] ?? SOUND_MAP.ding
    const vol = Math.min(Math.max(volumePct / 100, 0), 1) * 0.8
    this.master.gain.setValueAtTime(vol, this.ctx.currentTime)
    def.play(this.ctx, this.master, this.ctx.currentTime + 0.02)
  }
}

export const soundEngine = new SoundEngine()
