/**
 * Общее состояние линейного раскроя:
 * таблицы, настройки, результат, история, кнопки «Раскрой» / «Пример».
 * Страница листа (/sheet) живёт отдельно и этот контекст не использует.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { sanitizeInputs, solveCutting, validateInputs } from '../algorithm/solve'
import {
  addHistoryEntry,
  clearHistory,
  loadHistory,
  removeHistoryEntry,
} from '../storage/history'
import {
  DEFAULT_SETTINGS,
  DEMO_PARTS,
  DEMO_STOCKS,
  emptyPart,
  emptyStock,
  type HistoryEntry,
  type PartItem,
  type Settings,
  type SolveResult,
  type StockItem,
  uid,
} from '../types'

const SETTINGS_KEY = 'raskroy-settings-v1'

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      resultOrder: parsed.resultOrder?.length ? parsed.resultOrder : DEFAULT_SETTINGS.resultOrder,
      resultVisible: { ...DEFAULT_SETTINGS.resultVisible, ...(parsed.resultVisible || {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

type AppContextValue = {
  stocks: StockItem[]
  setStocks: (v: StockItem[]) => void
  parts: PartItem[]
  setParts: (v: PartItem[]) => void
  settings: Settings
  setSettings: (v: Settings) => void
  result: SolveResult | null
  error: string | null
  calculating: boolean
  cuttingName: string
  setCuttingName: (v: string) => void
  history: HistoryEntry[]
  calculate: () => void
  clearAll: () => void
  loadDemo: () => void
  saveHistory: () => void
  loadHistoryEntry: (entry: HistoryEntry) => void
  deleteHistoryEntry: (id: string) => void
  clearAllHistory: () => void
  refreshHistory: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [stocks, setStocks] = useState<StockItem[]>(DEMO_STOCKS)
  const [parts, setParts] = useState<PartItem[]>(DEMO_PARTS)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [result, setResult] = useState<SolveResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [cuttingName, setCuttingName] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  const refreshHistory = useCallback(() => {
    setHistory(loadHistory())
  }, [])

  const calculate = useCallback(() => {
    const cleaned = sanitizeInputs(stocks, parts)
    setStocks(cleaned.stocks.length ? [...cleaned.stocks, emptyStock()] : [emptyStock()])
    setParts(cleaned.parts.length ? [...cleaned.parts, emptyPart()] : [emptyPart()])

    const validationError = validateInputs(cleaned.stocks, cleaned.parts)
    if (validationError) {
      setError(validationError)
      setResult(null)
      navigate('/stocks#result')
      return
    }

    setCalculating(true)
    setError(null)

    window.setTimeout(() => {
      try {
        setResult(solveCutting(cleaned.stocks, cleaned.parts, settings))
      } catch {
        setError('Не удалось выполнить расчёт')
        setResult(null)
      } finally {
        setCalculating(false)
        navigate('/stocks#result')
      }
    }, 30)
  }, [stocks, parts, settings, navigate])

  const clearAll = useCallback(() => {
    setStocks([emptyStock()])
    setParts([emptyPart()])
    setResult(null)
    setError(null)
    setCuttingName('')
    navigate('/stocks')
  }, [navigate])

  const loadDemo = useCallback(() => {
    setStocks(DEMO_STOCKS.map((s) => ({ ...s, id: uid('s') })))
    setParts(DEMO_PARTS.map((p) => ({ ...p, id: uid('p') })))
    setResult(null)
    setError(null)
    setCuttingName('')
    navigate('/stocks')
  }, [navigate])

  const saveHistory = useCallback(() => {
    const title = cuttingName.trim() || `Раскрой ${new Date().toLocaleString('ru-RU')}`
    const entry: HistoryEntry = {
      id: uid('h'),
      title,
      createdAt: new Date().toISOString(),
      stocks,
      parts,
      settings,
      result,
    }
    setHistory(addHistoryEntry(entry))
    navigate('/history')
  }, [cuttingName, stocks, parts, settings, result, navigate])

  const loadHistoryEntry = useCallback(
    (entry: HistoryEntry) => {
      setStocks(entry.stocks)
      setParts(entry.parts)
      setSettings({
        ...DEFAULT_SETTINGS,
        ...entry.settings,
        resultVisible: {
          ...DEFAULT_SETTINGS.resultVisible,
          ...(entry.settings.resultVisible || {}),
        },
        resultOrder: entry.settings.resultOrder?.length
          ? entry.settings.resultOrder
          : DEFAULT_SETTINGS.resultOrder,
      })
      setResult(entry.result)
      setCuttingName(entry.title)
      setError(null)
      navigate(entry.result ? '/stocks#result' : '/stocks')
    },
    [navigate],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      stocks,
      setStocks,
      parts,
      setParts,
      settings,
      setSettings,
      result,
      error,
      calculating,
      cuttingName,
      setCuttingName,
      history,
      calculate,
      clearAll,
      loadDemo,
      saveHistory,
      loadHistoryEntry,
      deleteHistoryEntry: (id) => setHistory(removeHistoryEntry(id)),
      clearAllHistory: () => setHistory(clearHistory()),
      refreshHistory,
    }),
    [
      stocks,
      parts,
      settings,
      result,
      error,
      calculating,
      cuttingName,
      history,
      calculate,
      clearAll,
      loadDemo,
      saveHistory,
      loadHistoryEntry,
      refreshHistory,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
