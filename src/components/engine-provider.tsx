'use client'

import { useEffect } from 'react'
import { getHub } from '@/engines/hub'
import { soundEngine } from '@/engines/sound'
import { voiceEngine } from '@/engines/voice'
import { useApp } from '@/stores/app-store'
import type { ReactNode } from 'react'

/**
 * Запускает движки скринера на время сессии дашборда.
 * Разблокирует аудио по первому клику (политика autoplay).
 */
export function EngineProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const hub = getHub()
    hub.start()

    const unlock = () => soundEngine.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      voiceEngine.stop()
      hub.stop()
    }
  }, [])

  // Синхронизация параметров голоса с настройками
  const voice = useApp((s) => s.voice)
  useEffect(() => {
    voiceEngine.rate = voice.rate
    voiceEngine.pitch = voice.pitch
    voiceEngine.volume = voice.volume
    voiceEngine.voiceURI = voice.voiceURI
  }, [voice])

  // Первичная загрузка списка голосов
  useEffect(() => {
    voiceEngine.refreshVoices()
    return () => {
      voiceEngine.stop()
    }
  }, [])

  return <>{children}</>
}
