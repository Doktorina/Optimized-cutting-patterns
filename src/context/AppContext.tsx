/**
 * Общее состояние линейного раскроя:
 * таблицы, настройки, результат, история, кнопки «Раскрой» / «Очистить».
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
import { solveViaSmartCut } from '../algorithm/smartcutApi'
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
const DATA_KEY = 'raskroy-line-data-v1'

const ENV_SMARTCUT_TOKEN = String(import.meta.env.VITE_SMARTCUT_API_TOKEN || '').trim()

function withEnvSmartCutDefaults(settings: Settings): Settings {
  if (settings.smartCutApiToken?.trim() || !ENV_SMARTCUT_TOKEN) return settings
  return {
    ...settings,
    smartCutApiToken: ENV_SMARTCUT_TOKEN,
    useSmartCutApi: true,
  }
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return withEnvSmartCutDefaults({ ...DEFAULT_SETTINGS })
    const parsed = JSON.parse(raw) as Partial<Settings>
    return withEnvSmartCutDefaults({
      ...DEFAULT_SETTINGS,
      ...parsed,
      resultOrder: parsed.resultOrder?.length ? parsed.resultOrder : DEFAULT_SETTINGS.resultOrder,
      resultVisible: { ...DEFAULT_SETTINGS.resultVisible, ...(parsed.resultVisible || {}) },
    })
  } catch {
    return withEnvSmartCutDefaults({ ...DEFAULT_SETTINGS })
  }
}

function normalizeStockPriority(s: StockItem): StockItem {
  const p = s.priority
  const priority =
    typeof p === 'number' && Number.isFinite(p) ? p : Number(p)
  return {
    ...s,
    priority: Number.isFinite(priority) ? priority : 0,
  }
}

function loadLineData(): { stocks: StockItem[]; parts: PartItem[]; cuttingName: string } {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return { stocks: DEMO_STOCKS, parts: DEMO_PARTS, cuttingName: '' }
    const parsed = JSON.parse(raw) as {
      stocks?: StockItem[]
      parts?: PartItem[]
      cuttingName?: string
    }
    const stocks = Array.isArray(parsed.stocks) && parsed.stocks.length
      ? parsed.stocks.map(normalizeStockPriority)
      : DEMO_STOCKS
    const parts = Array.isArray(parsed.parts) && parsed.parts.length ? parsed.parts : DEMO_PARTS
    return {
      stocks,
      parts,
      cuttingName: typeof parsed.cuttingName === 'string' ? parsed.cuttingName : '',
    }
  } catch {
    return { stocks: DEMO_STOCKS, parts: DEMO_PARTS, cuttingName: '' }
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
  clearResult: () => void
  saveHistory: () => void
  loadHistoryEntry: (entry: HistoryEntry) => void
  deleteHistoryEntry: (id: string) => void
  clearAllHistory: () => void
  refreshHistory: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [stocks, setStocks] = useState<StockItem[]>(() => loadLineData().stocks)
  const [parts, setParts] = useState<PartItem[]>(() => loadLineData().parts)
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [result, setResult] = useState<SolveResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [cuttingName, setCuttingName] = useState(() => loadLineData().cuttingName)
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory())

  useEffect(() => {
    const t = window.setTimeout(() => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    }, 300)
    return () => window.clearTimeout(t)
  }, [settings])

  useEffect(() => {
    const t = window.setTimeout(() => {
      localStorage.setItem(
        DATA_KEY,
        JSON.stringify({ stocks, parts, cuttingName }),
      )
    }, 400)
    return () => window.clearTimeout(t)
  }, [stocks, parts, cuttingName])

  const refreshHistory = useCallback(() => {
    setHistory(loadHistory())
  }, [])

  const calculate = useCallback(() => {
    const cleaned = sanitizeInputs(stocks, parts)

    const validationError = validateInputs(cleaned.stocks, cleaned.parts)
    if (validationError) {
      setError(validationError)
      setResult(null)
      navigate('/stocks#result')
      return
    }

    setCalculating(true)
    setError(null)

    const run = async () => {
      try {
        if (settings.useSmartCutApi && settings.smartCutApiToken.trim()) {
          setResult(
            await solveViaSmartCut(
              cleaned.stocks,
              cleaned.parts,
              settings,
              settings.smartCutApiToken,
            ),
          )
        } else {
          setResult(solveCutting(cleaned.stocks, cleaned.parts, settings))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось выполнить расчёт')
        setResult(null)
      } finally {
        setCalculating(false)
        navigate('/stocks#result')
      }
    }

    void run()
  }, [stocks, parts, settings, navigate])

  const clearAll = useCallback(() => {
    setStocks([emptyStock()])
    setParts([emptyPart()])
    setResult(null)
    setError(null)
    setCuttingName('')
    try {
      localStorage.removeItem(DATA_KEY)
    } catch {
      /* ignore */
    }
    navigate('/stocks')
  }, [navigate])

  const clearResult = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

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
      setStocks((entry.stocks || []).map(normalizeStockPriority))
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
      clearResult,
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
      clearResult,
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
