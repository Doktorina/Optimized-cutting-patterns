/** История расчётов в localStorage (ключ raskroy-history-v1, до 100 записей). */
import type { HistoryEntry } from '../types'

const KEY = 'raskroy-history-v1'

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 100)))
}

export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory().filter((e) => e.id !== entry.id)]
  saveHistory(next)
  return next
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id)
  saveHistory(next)
  return next
}

export function clearHistory(): HistoryEntry[] {
  saveHistory([])
  return []
}
