import type { GameState } from './types'

export const SAVE_KEY = 'monopoly-local-save'

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function saveGame(state: GameState): void {
  getStorage()?.setItem(SAVE_KEY, JSON.stringify(state))
}

export function loadGame(): GameState | null {
  const saved = getStorage()?.getItem(SAVE_KEY)

  if (!saved) {
    return null
  }

  try {
    return JSON.parse(saved) as GameState
  } catch {
    return null
  }
}

export function clearSavedGame(): void {
  getStorage()?.removeItem(SAVE_KEY)
}
