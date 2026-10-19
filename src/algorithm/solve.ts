/**
 * Алгоритм линейного (1D) раскроя.
 *
 * Вход: заготовки + отрезки + настройки (пропил, торцовка).
 * Выход: SolveResult — схемы, остатки, % пользы.
 *
 * Углы: длина отрезка = среднее (L1+L2)/2; с заготовки снимается «носик» (angleTipAllowance).
 * sanitizeInputs / validateInputs — перед расчётом из UI.
 */
import type {
  CuttingPattern,
  GroupedPattern,
  PartItem,
  PlacedPart,
  Settings,
  SolveResult,
  StockItem,
} from '../types'
import { angleTipAllowance, partCalcLength, roundLen } from '../types'

type PartType = {
  length: number
  name: string
  partKey: string
  remaining: number
}

type StockOption = {
  /** Физическая длина заготовки (как ввёл пользователь) */
  length: number
  /** Уменьшение под «носик» угла */
  tipAllowance: number
  name: string
  priority: number
  remaining: number
}

function effectiveCapacity(stockLength: number, trimming: number, tipAllowance = 0): number {
  return Math.max(0, stockLength - trimming - tipAllowance)
}

function patternSignature(p: CuttingPattern): string {
  const parts = p.parts.map((x) => `${x.length}:${x.name}`).join('|')
  return `${p.stockLength}|${parts}|${p.waste}`
}

function groupPatterns(patterns: CuttingPattern[]): GroupedPattern[] {
  const groups: GroupedPattern[] = []
  let i = 0
  let boardIndex = 1
  while (i < patterns.length) {
    const sig = patternSignature(patterns[i])
    let j = i + 1
    while (j < patterns.length && patternSignature(patterns[j]) === sig) j++
    const count = j - i
    groups.push({
      pattern: patterns[i],
      count,
      startIndex: boardIndex,
      endIndex: boardIndex + count - 1,
    })
    boardIndex += count
    i = j
  }
  return groups
}

function prepareStocks(
  stocks: StockItem[],
  settings: Settings,
  tipAllowance = 0,
): StockOption[] {
  const options: StockOption[] = stocks
    .filter((s) => typeof s.length === 'number' && s.length > 0)
    .map((s) => ({
      length: roundLen(s.length as number),
      tipAllowance: roundLen(tipAllowance),
      name: s.name,
      priority: s.priority || 0,
      remaining: s.quantity === '' || s.quantity === undefined ? Infinity : Number(s.quantity),
    }))
    .filter((s) => s.remaining > 0 && s.length - s.tipAllowance > 0)

  if (settings.sortStocks === 'asc') {
    options.sort((a, b) => a.length - b.length || a.priority - b.priority)
  } else if (settings.sortStocks === 'desc') {
    options.sort((a, b) => b.length - a.length || a.priority - b.priority)
  } else if (settings.sortStocks === 'priority') {
    options.sort((a, b) => a.priority - b.priority || b.length - a.length)
  } else {
    options.sort((a, b) => a.priority - b.priority || b.length - a.length)
  }
  return options
}

function buildPartTypes(parts: PartItem[], settings: Settings): PartType[] {
  const map = new Map<string, PartType>()
  for (const p of parts) {
    const calcLen = partCalcLength(p)
    if (!(calcLen > 0 && typeof p.quantity === 'number' && p.quantity > 0)) {
      continue
    }
    const label =
      typeof p.length2 === 'number' && p.length2 > 0 && typeof p.length === 'number'
        ? `${p.name || ''}`.trim() || `${p.length}/${p.length2}`
        : p.name
    const key = `${calcLen}|${label}`
    const existing = map.get(key)
    if (existing) existing.remaining += p.quantity as number
    else {
      map.set(key, {
        length: calcLen,
        name: label,
        partKey: key,
        remaining: p.quantity as number,
      })
    }
  }

  const list = [...map.values()]
  if (settings.sortParts === 'asc') list.sort((a, b) => a.length - b.length)
  else list.sort((a, b) => b.length - a.length)
  return list
}

/** Набить одну заготовку отрезками максимально плотно (с учётом пропила). */
function packBar(
  capacity: number,
  types: PartType[],
  kerf: number,
): PlacedPart[] {
  let bestParts: PlacedPart[] = []
  let bestUsed = -1
  let bestCount = -1

  const counts = new Array(types.length).fill(0)

  const materialize = (): PlacedPart[] => {
    const ordered = types
      .map((t, i) => ({ t, c: counts[i] }))
      .filter((x) => x.c > 0)
      .sort((a, b) => b.t.length - a.t.length)
    const out: PlacedPart[] = []
    for (const { t, c } of ordered) {
      const len = roundLen(t.length)
      for (let k = 0; k < c; k++) {
        out.push({ length: len, name: t.name, partKey: t.partKey })
      }
    }
    return out
  }

  const usedWithKerf = (): { used: number; count: number } => {
    let count = 0
    let used = 0
    for (let i = 0; i < types.length; i++) {
      for (let k = 0; k < counts[i]; k++) {
        used += count === 0 ? types[i].length : types[i].length + kerf
        count += 1
      }
    }
    return { used, count }
  }

  const dfs = (typeIndex: number) => {
    if (typeIndex >= types.length) {
      const { used, count } = usedWithKerf()
      if (used > bestUsed + 1e-9 || (Math.abs(used - bestUsed) < 1e-9 && count > bestCount)) {
        bestUsed = used
        bestCount = count
        bestParts = materialize()
      }
      return
    }

    const t = types[typeIndex]
    const maxByQty = t.remaining
    let maxByLen = 0
    {
      let used = 0
      let count = 0
      for (let i = 0; i < typeIndex; i++) {
        for (let k = 0; k < counts[i]; k++) {
          used += count === 0 ? types[i].length : types[i].length + kerf
          count += 1
        }
      }
      while (maxByLen < maxByQty) {
        const isFirst = (count + maxByLen) === 0
        const space = isFirst ? t.length : t.length + kerf
        if (used + space > capacity + 1e-9) break
        used += space
        maxByLen += 1
      }
    }

    for (let c = maxByLen; c >= 0; c--) {
      counts[typeIndex] = c
      dfs(typeIndex + 1)
    }
    counts[typeIndex] = 0
  }

  dfs(0)
  return bestParts
}

function pickStockForPack(
  options: StockOption[],
  types: PartType[],
  trimming: number,
  kerf: number,
): { stockIdx: number; parts: PlacedPart[] } | null {
  let best: { stockIdx: number; parts: PlacedPart[]; waste: number; used: number } | null = null

  for (let i = 0; i < options.length; i++) {
    const opt = options[i]
    if (opt.remaining <= 0) continue
    const cap = effectiveCapacity(opt.length, trimming, opt.tipAllowance)
    const minPiece = types.reduce(
      (m, t) => (t.remaining > 0 ? Math.min(m, t.length) : m),
      Infinity,
    )
    if (!Number.isFinite(minPiece) || minPiece > cap) continue

    const parts = packBar(cap, types, kerf)
    if (parts.length === 0) continue

    let usedWithKerf = 0
    parts.forEach((p, idx) => {
      usedWithKerf += idx === 0 ? p.length : p.length + kerf
    })
    const waste = cap - usedWithKerf
    const usedLen = parts.reduce((s, p) => s + p.length, 0)

    if (
      !best ||
      waste < best.waste - 1e-9 ||
      (Math.abs(waste - best.waste) < 1e-9 && usedLen > best.used)
    ) {
      best = { stockIdx: i, parts, waste, used: usedLen }
    }
  }

  if (!best) return null
  return { stockIdx: best.stockIdx, parts: best.parts }
}

/** Главный расчёт 1D: повторять лучшую раскладку, пока есть отрезки и заготовки. */
export function solveCutting(
  stocks: StockItem[],
  parts: PartItem[],
  settings: Settings,
): SolveResult {
  const kerf = Math.max(0, settings.bladeKerf || 0)
  const trimming = Math.max(0, settings.trimming || 0)

  const tipAllowance = angleTipAllowance(parts)
  const types = buildPartTypes(parts, settings)
  const stockOptions = prepareStocks(stocks, settings, tipAllowance)
  const initialStockCounts = new Map(
    stockOptions.map((s) => [`${s.length}|${s.name}`, { ...s, initial: s.remaining }]),
  )

  const patterns: CuttingPattern[] = []

  while (types.some((t) => t.remaining > 0)) {
    const pick = pickStockForPack(stockOptions, types, trimming, kerf)
    if (!pick) break

    const opt = stockOptions[pick.stockIdx]
    opt.remaining -= 1

    const placed = pick.parts
    for (const p of placed) {
      const t = types.find((x) => x.partKey === p.partKey)
      if (t) t.remaining -= 1
    }

    const roundedParts = placed.map((p) => ({ ...p, length: roundLen(p.length) }))
    const partsLength = roundLen(roundedParts.reduce((s, p) => s + p.length, 0))
    let usedWithKerf = 0
    roundedParts.forEach((p, idx) => {
      usedWithKerf += idx === 0 ? p.length : p.length + kerf
    })
    usedWithKerf = roundLen(usedWithKerf)
    const cap = effectiveCapacity(opt.length, trimming, opt.tipAllowance)
    const waste = Math.max(0, roundLen(cap - usedWithKerf))

    patterns.push({
      stockLength: opt.length,
      stockName: opt.name,
      parts: roundedParts,
      usedLength: partsLength,
      waste,
      cutCount: roundedParts.length,
    })
  }

  patterns.sort((a, b) => {
    if (a.stockLength !== b.stockLength) return b.stockLength - a.stockLength
    const sa = a.parts.map((p) => p.length).join(',')
    const sb = b.parts.map((p) => p.length).join(',')
    return sa.localeCompare(sb)
  })

  const cutCount = patterns.reduce((sum, p) => {
    if (p.parts.length === 0) return sum
    const between = Math.max(0, p.parts.length - 1)
    const wasteCut = p.waste > 0 ? 1 : 0
    return sum + between + wasteCut
  }, 0)

  const grouped = groupPatterns(patterns)

  const stocksUsedMap = new Map<string, { length: number; name: string; count: number; totalLength: number }>()
  for (const p of patterns) {
    const key = `${p.stockLength}|${p.stockName}`
    const cur = stocksUsedMap.get(key) || {
      length: p.stockLength,
      name: p.stockName,
      count: 0,
      totalLength: 0,
    }
    cur.count += 1
    cur.totalLength += p.stockLength
    stocksUsedMap.set(key, cur)
  }
  const stocksUsed = [...stocksUsedMap.values()]

  const totalStockLength = patterns.reduce((s, p) => s + p.stockLength, 0)
  const totalPartsLength = patterns.reduce((s, p) => s + p.usedLength, 0)
  const wasteLength = Math.max(0, totalStockLength - totalPartsLength)
  const usefulPercent = totalStockLength > 0 ? (totalPartsLength / totalStockLength) * 100 : 0
  const wastePercent = totalStockLength > 0 ? (wasteLength / totalStockLength) * 100 : 0

  const remMap = new Map<number, number>()
  for (const p of patterns) {
    if (p.waste > 0) remMap.set(p.waste, (remMap.get(p.waste) || 0) + 1)
  }
  const remainders = [...remMap.entries()]
    .map(([length, count]) => ({ length, count }))
    .sort((a, b) => b.length - a.length)

  const uncutParts = types
    .filter((t) => t.remaining > 0)
    .map((t) => ({ length: t.length, name: t.name, quantity: t.remaining }))

  const unusedStocks: SolveResult['unusedStocks'] = []
  for (const [, s] of initialStockCounts) {
    if (!Number.isFinite(s.initial)) continue
    const used =
      stocksUsed.find((u) => u.length === s.length && u.name === s.name)?.count || 0
    const left = s.initial - used
    if (left > 0) unusedStocks.push({ length: s.length, name: s.name, quantity: left })
  }

  return {
    patterns,
    grouped,
    stocksUsed,
    totalStockLength,
    totalPartsLength,
    usefulPercent,
    wastePercent,
    wasteLength,
    cutCount,
    remainders,
    uncutParts,
    unusedStocks,
  }
}

function asNum(v: unknown): number | '' {
  if (v === '' || v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? v : ''
  const n = Number(String(v).trim().replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : ''
}

function normalizePart(p: PartItem): PartItem {
  return {
    ...p,
    length: asNum(p.length),
    length2: asNum(p.length2 ?? ''),
    quantity: asNum(p.quantity),
    name: p.name || '',
  }
}

function normalizeStock(s: StockItem): StockItem {
  return {
    ...s,
    length: asNum(s.length),
    quantity: asNum(s.quantity),
    name: s.name || '',
    priority: typeof s.priority === 'number' ? s.priority : Number(s.priority) || 0,
  }
}

function isBlankPart(p: PartItem): boolean {
  const n = normalizePart(p)
  const noLen = partCalcLength(n) <= 0
  const noQty = n.quantity === '' || n.quantity === 0
  const noL2 = n.length2 === '' || n.length2 === 0
  return noLen && noQty && noL2 && !n.name
}

function isBlankStock(s: StockItem): boolean {
  const n = normalizeStock(s)
  const noLen = n.length === '' || n.length === 0
  const noQty = n.quantity === '' || n.quantity === 0
  return noLen && noQty && !n.name
}

/** Убрать пустые строки таблиц перед расчётом. */
export function sanitizeInputs(
  stocks: StockItem[],
  parts: PartItem[],
): { stocks: StockItem[]; parts: PartItem[] } {
  return {
    stocks: stocks.map(normalizeStock).filter((s) => !isBlankStock(s)),
    parts: parts.map(normalizePart).filter((p) => !isBlankPart(p)),
  }
}

/** Проверка ввода; текст ошибки для UI или null. */
export function validateInputs(stocks: StockItem[], parts: PartItem[]): string | null {
  const clean = sanitizeInputs(stocks, parts)

  if (!clean.stocks.some((s) => typeof s.length === 'number' && s.length > 0)) {
    return 'Укажите длину хотя бы одной заготовки'
  }

  let validCount = 0
  for (const p of clean.parts) {
    const calcLen = partCalcLength(p)
    const hasLen = calcLen > 0
    const qty = asNum(p.quantity)
    const hasQty = typeof qty === 'number' && qty > 0

    if (hasLen && hasQty) {
      validCount++
      continue
    }

    if (hasLen && !hasQty) {
      return 'У отрезка указана длина, но не количество — заполните оба поля'
    }
    if (!hasLen && hasQty) {
      return 'У отрезка указано количество, но не длина — заполните оба поля'
    }
    if (p.name && !hasLen) {
      return 'Есть отрезок только с названием — укажите длину и количество'
    }
  }

  if (validCount === 0) {
    return 'Добавьте хотя бы один отрезок (длина и количество)'
  }

  return null
}
