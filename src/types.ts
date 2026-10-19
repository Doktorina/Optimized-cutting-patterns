/**
 * Общие типы и константы линейного раскроя.
 * Заготовки (Stock) режутся на отрезки (Part).
 * Пустая строка '' в числе = «не задано» (для qty заготовки — без лимита).
 */

// —— Входные данные ——

export type StockItem = {
  id: string
  length: number | ''
  quantity: number | '' // '' = без лимита
  name: string
  priority: number
}

export type PartItem = {
  id: string
  length: number | ''
  /** Вторая длина торца при раскрое под углом (необязательно) */
  length2: number | ''
  quantity: number | ''
  name: string
}

/** Блоки на панели результата (порядок/видимость в Настройках) */
export type ResultBlockId =
  | 'unusedStocks'
  | 'uncutParts'
  | 'stocksUsed'
  | 'cuttingMap'
  | 'textScheme'
  | 'sizesFromZero'
  | 'usefulRemainders'
  | 'remainders'
  | 'inputData'
  | 'cuttingName'
  | 'bladeKerf'
  | 'jsonScheme'
  | 'developer'

// —— Настройки и результат ——

export type Settings = {
  bladeKerf: number
  trimming: number
  units: string
  sortStocks: 'none' | 'asc' | 'desc' | 'priority'
  sortParts: 'none' | 'asc' | 'desc'
  numberLayout: boolean
  mergeIdenticalParts: boolean
  usefulRemainderMin: number
  resultOrder: ResultBlockId[]
  resultVisible: Record<ResultBlockId, boolean>
}

/** Один отрезок на схеме (уже числовая длина) */
export type PlacedPart = {
  length: number
  name: string
  partKey: string
}

/** Одна раскладка на одной заготовке */
export type CuttingPattern = {
  stockLength: number
  stockName: string
  parts: PlacedPart[]
  usedLength: number
  waste: number
  cutCount: number
}

/** Одинаковые раскладки, схлопнутые для отображения */
export type GroupedPattern = {
  pattern: CuttingPattern
  count: number
  startIndex: number
  endIndex: number
}

export type SolveResult = {
  patterns: CuttingPattern[]
  grouped: GroupedPattern[]
  stocksUsed: { length: number; name: string; count: number; totalLength: number }[]
  totalStockLength: number
  totalPartsLength: number
  usefulPercent: number
  wastePercent: number
  wasteLength: number
  cutCount: number
  remainders: { length: number; count: number }[]
  uncutParts: { length: number; name: string; quantity: number }[]
  unusedStocks: { length: number; name: string; quantity: number }[]
}

export type HistoryEntry = {
  id: string
  title: string
  createdAt: string
  stocks: StockItem[]
  parts: PartItem[]
  settings: Settings
  result: SolveResult | null
}

// —— Подписи блоков результата / значения по умолчанию ——

export const RESULT_BLOCK_META: { id: ResultBlockId; label: string; reorderable: boolean }[] = [
  { id: 'unusedStocks', label: 'Неиспользованные заготовки', reorderable: true },
  { id: 'uncutParts', label: 'Неразрезанные отрезки', reorderable: true },
  { id: 'stocksUsed', label: 'Использовано заготовок', reorderable: true },
  { id: 'cuttingMap', label: 'Схема раскроя', reorderable: true },
  { id: 'textScheme', label: 'Схема раскроя в текстовом формате', reorderable: true },
  { id: 'sizesFromZero', label: 'Размеры от нуля', reorderable: true },
  { id: 'usefulRemainders', label: 'Полезные остатки', reorderable: true },
  { id: 'remainders', label: 'Остатки', reorderable: true },
  { id: 'inputData', label: 'Входные данные', reorderable: true },
  { id: 'cuttingName', label: 'Название и описание', reorderable: false },
  { id: 'bladeKerf', label: 'Толщина лезвия', reorderable: false },
  { id: 'jsonScheme', label: 'Схема для программ (текст)', reorderable: false },
  { id: 'developer', label: 'О программе', reorderable: false },
]

export const DEFAULT_RESULT_ORDER: ResultBlockId[] = RESULT_BLOCK_META.map((m) => m.id)

export const DEFAULT_RESULT_VISIBLE: Record<ResultBlockId, boolean> = {
  unusedStocks: true,
  uncutParts: true,
  stocksUsed: true,
  cuttingMap: true,
  textScheme: true,
  sizesFromZero: true,
  usefulRemainders: true,
  remainders: true,
  inputData: true,
  cuttingName: true,
  bladeKerf: true,
  jsonScheme: false,
  developer: true,
}

// —— Демо и вспомогательные функции ——

/** Пример: доска 6 м → отрезки 1.2 / 2.3 / 3 / 0.8 м */
export const DEMO_STOCKS: StockItem[] = [
  { id: 's1', length: 6000, quantity: '', name: 'доска 6м', priority: 0 },
  { id: 's2', length: '', quantity: '', name: '', priority: 0 },
]

export const DEMO_PARTS: PartItem[] = [
  { id: 'p1', length: 1200, length2: '', quantity: 23, name: '1.2м' },
  { id: 'p2', length: 2300, length2: '', quantity: 12, name: '2.3м' },
  { id: 'p3', length: 3000, length2: '', quantity: 6, name: '3м' },
  { id: 'p4', length: 800, length2: '', quantity: 17, name: '0.8м' },
  { id: 'p5', length: '', length2: '', quantity: '', name: '' },
]

export const DEFAULT_SETTINGS: Settings = {
  bladeKerf: 0,
  trimming: 0,
  units: 'мм',
  sortStocks: 'none',
  sortParts: 'none',
  numberLayout: true,
  mergeIdenticalParts: true,
  usefulRemainderMin: 0,
  resultOrder: [...DEFAULT_RESULT_ORDER],
  resultVisible: { ...DEFAULT_RESULT_VISIBLE },
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function emptyStock(): StockItem {
  return { id: uid('s'), length: '', quantity: '', name: '', priority: 0 }
}

export function emptyPart(): PartItem {
  return { id: uid('p'), length: '', length2: '', quantity: '', name: '' }
}

/** Округление длины до сотых. */
export function roundLen(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/** Средняя длина отрезка (для торцов под углом). */
export function partCalcLength(p: Pick<PartItem, 'length' | 'length2'>): number {
  const a = typeof p.length === 'number' ? p.length : 0
  const b = typeof p.length2 === 'number' && p.length2 > 0 ? p.length2 : 0
  if (a > 0 && b > 0) return roundLen((a + b) / 2)
  return roundLen(a)
}

/**
 * «Носик» угла: насколько уменьшить длину заготовки.
 * При одинаковых углах — max(|L1−L2|/2) по отрезкам.
 */
export function angleTipAllowance(parts: PartItem[]): number {
  let tip = 0
  for (const p of parts) {
    const a = typeof p.length === 'number' ? p.length : 0
    const b = typeof p.length2 === 'number' ? p.length2 : 0
    if (a > 0 && b > 0) tip = Math.max(tip, roundLen(Math.abs(a - b) / 2))
  }
  return tip
}
