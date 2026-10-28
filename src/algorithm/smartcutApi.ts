/**
 * Клиент SmartCut.Pro API v1 (линейный раскрой).
 * Документация: https://smartcut.pro/ru/faq
 *
 * Формула params:
 *   -l {пропил} -s {режим} -b {длина}:{кол-во}… -c {длина}-{кол-во}…
 * Длины в API — целые. Если ввод в метрах (11,7) → ×1000 (11700).
 * Если уже мм/тысячные (6000) — как есть.
 * Кол-во заготовки > 0; «без лимита» → 99999.
 */
import type {
  CuttingPattern,
  PartItem,
  PlacedPart,
  Settings,
  SolveResult,
  StockItem,
} from '../types'
import { partCalcLength, roundLen } from '../types'
import { improvePatternsFill } from './solve'

const API_URL = '/smartcut-api/'
const UNLIMITED_QTY = 99999

type UnitScale = 'meters' | 'raw'

type ApiSchemeCut = {
  part_name: string
  part_length: number
  quantity: number
  size_from_zero: number
}

type ApiScheme = {
  scheme_index: number
  number_from: number
  number_to: number
  material_name: string
  material_length: number
  quantity: number
  cutting: ApiSchemeCut[]
}

type ApiResponse = {
  status: string
  message?: string | null
  solution?: Record<string, Array<[number, Record<string, number>]>>
  data?: {
    used_materials_length?: number
    used_parts_length?: number
    offcuts?: { length: number; quantity: number }[]
    scheme?: ApiScheme[]
    uncut_parts?: { part_length: number; quantity: number; part_name?: string }[]
    unused_materials?: { material_length: number; quantity: number; material_name?: string }[]
  }
}

/** Есть длины < 100 (11.7) → метры; иначе уже как в API (мм). */
export function detectUnitScale(stocks: StockItem[], parts: PartItem[]): UnitScale {
  const lens: number[] = []
  for (const s of stocks) {
    if (typeof s.length === 'number' && s.length > 0) lens.push(s.length)
  }
  for (const p of parts) {
    const len = partCalcLength(p)
    if (len > 0) lens.push(len)
  }
  if (lens.some((l) => l > 0 && l < 100)) return 'meters'
  return 'raw'
}

export function toApiUnits(n: number, scale: UnitScale): number {
  if (scale === 'raw') return Math.round(n)
  return Math.round(n * 1000)
}

export function fromApiUnits(n: number, scale: UnitScale): number {
  if (scale === 'raw') return roundLen(n)
  return roundLen(n / 1000)
}

function stockQtyForApi(q: number | ''): number {
  if (q === '' || q === undefined || q === null) return UNLIMITED_QTY
  const n = Math.floor(Number(q))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Очерёдность: 1 → 2 → …; 0 в конце (как в локальном решателе). */
function priorityRank(p: number): number {
  return p > 0 ? p : Number.MAX_SAFE_INTEGER
}

function stockPriorityValue(s: StockItem): number {
  const p = typeof s.priority === 'number' ? s.priority : Number(s.priority) || 0
  return Number.isFinite(p) ? p : 0
}

export function buildSmartCutParams(
  stocks: StockItem[],
  parts: PartItem[],
  settings: Settings,
  scale: UnitScale,
  sortMode = 2,
): string | null {
  const kerfU = toApiUnits(Math.max(0, settings.bladeKerf || 0), scale)
  const trimU = toApiUnits(Math.max(0, settings.trimming || 0), scale)

  const blanks: string[] = []
  for (const s of stocks) {
    if (typeof s.length !== 'number' || !(s.length > 0)) continue
    const qty = stockQtyForApi(s.quantity)
    if (qty <= 0) continue
    let lenU = toApiUnits(s.length, scale)
    if (trimU > 0) lenU = Math.max(0, lenU - trimU)
    if (lenU <= 0) continue
    blanks.push(`${lenU}:${qty}`)
  }

  const cuts: string[] = []
  for (const p of parts) {
    const len = partCalcLength(p)
    const qty = typeof p.quantity === 'number' ? Math.floor(p.quantity) : 0
    if (!(len > 0) || qty <= 0) continue
    cuts.push(`${toApiUnits(len, scale)}-${qty}`)
  }

  if (!blanks.length || !cuts.length) return null
  return `-l ${kerfU} -s ${sortMode} -b ${blanks.join(' ')} -c ${cuts.join(' ')}`
}

/** Только отрезки, которые физически лезут на заготовки этой группы. */
function partsFittingStocks(
  parts: PartItem[],
  stocks: StockItem[],
  trimming: number,
): PartItem[] {
  const maxStock = Math.max(
    0,
    ...stocks.map((s) => (typeof s.length === 'number' ? s.length : 0)),
  )
  const usable = Math.max(0, roundLen(maxStock - Math.max(0, trimming)))
  if (!(usable > 0)) return []
  return parts.filter((p) => {
    const len = partCalcLength(p)
    const qty = typeof p.quantity === 'number' ? p.quantity : 0
    return len > 0 && qty > 0 && len <= usable + 1e-9
  })
}

function partKeyOf(length: number, name: string): string {
  return `${roundLen(length)}|${name || ''}`
}

function clonePartsWithQty(parts: PartItem[]): PartItem[] {
  return parts.map((p) => ({
    ...p,
    quantity:
      typeof p.quantity === 'number' && Number.isFinite(p.quantity)
        ? Math.max(0, Math.floor(p.quantity))
        : 0,
  }))
}

function subtractUsedParts(remaining: PartItem[], patterns: CuttingPattern[]): void {
  const used = new Map<string, number>()
  for (const pat of patterns) {
    for (const pl of pat.parts) {
      const key = partKeyOf(pl.length, pl.name)
      used.set(key, (used.get(key) || 0) + 1)
    }
  }
  for (const p of remaining) {
    const len = partCalcLength(p)
    if (!(len > 0)) continue
    const key = partKeyOf(len, p.name || '')
    const n = used.get(key) || 0
    if (n <= 0) continue
    const cur = typeof p.quantity === 'number' ? p.quantity : 0
    const take = Math.min(cur, n)
    p.quantity = cur - take
    used.set(key, n - take)
  }
}

function anyPartFitsStocks(
  parts: PartItem[],
  stocks: StockItem[],
  trimming: number,
): boolean {
  const maxStock = Math.max(
    0,
    ...stocks.map((s) => (typeof s.length === 'number' ? s.length : 0)),
  )
  const usable = Math.max(0, roundLen(maxStock - Math.max(0, trimming)))
  if (!(usable > 0)) return false
  return parts.some((p) => {
    const len = partCalcLength(p)
    const qty = typeof p.quantity === 'number' ? p.quantity : 0
    return len > 0 && qty > 0 && len <= usable
  })
}

function groupStocksByPriority(stocks: StockItem[]): StockItem[][] {
  const map = new Map<number, StockItem[]>()
  for (const s of stocks) {
    if (typeof s.length !== 'number' || !(s.length > 0)) continue
    if (stockQtyForApi(s.quantity) <= 0) continue
    const rank = priorityRank(stockPriorityValue(s))
    const list = map.get(rank) || []
    list.push(s)
    map.set(rank, list)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => list)
}

function expandCuttingToParts(
  cutting: ApiSchemeCut[],
  nameByLen: Map<number, string>,
  scale: UnitScale,
): PlacedPart[] {
  const out: PlacedPart[] = []
  for (const c of cutting) {
    const len = fromApiUnits(c.part_length, scale)
    const name = c.part_name || nameByLen.get(c.part_length) || ''
    const partKey = `${len}|${name}`
    for (let i = 0; i < c.quantity; i++) {
      out.push({ length: len, name, partKey })
    }
  }
  out.sort((a, b) => b.length - a.length)
  return out
}

function groupPatternsLocal(patterns: CuttingPattern[]): SolveResult['grouped'] {
  const groups: SolveResult['grouped'] = []
  let boardIndex = 1
  let i = 0
  while (i < patterns.length) {
    const sig = `${patterns[i].stockLength}|${patterns[i].parts.map((p) => `${p.length}:${p.name}`).join('|')}|${patterns[i].waste}`
    let j = i + 1
    while (
      j < patterns.length &&
      `${patterns[j].stockLength}|${patterns[j].parts.map((p) => `${p.length}:${p.name}`).join('|')}|${patterns[j].waste}` ===
        sig
    ) {
      j++
    }
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

async function fetchSmartCutPass(
  stocks: StockItem[],
  parts: PartItem[],
  settings: Settings,
  token: string,
  scale: UnitScale,
  sortMode: number,
): Promise<CuttingPattern[]> {
  const params = buildSmartCutParams(stocks, parts, settings, scale, sortMode)
  if (!params) return []

  const body = new URLSearchParams()
  body.set('api_token', token)
  body.set('params', params)

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  let json: ApiResponse
  try {
    json = (await res.json()) as ApiResponse
  } catch {
    throw new Error(`SmartCut API: неверный ответ (${res.status})`)
  }

  if (!res.ok || json.status !== 'ok') {
    const msg =
      typeof json.message === 'string' && json.message
        ? json.message
        : `Ошибка SmartCut API (${res.status})`
    throw new Error(msg)
  }

  const nameByLen = new Map<number, string>()
  for (const p of parts) {
    const len = partCalcLength(p)
    if (len > 0) nameByLen.set(toApiUnits(len, scale), p.name || '')
  }

  const kerf = Math.max(0, settings.bladeKerf || 0)
  const patterns: CuttingPattern[] = []
  const schemes = json.data?.scheme || []

  if (schemes.length) {
    for (const sch of schemes) {
      const stockLength = fromApiUnits(sch.material_length, scale)
      const placed = expandCuttingToParts(sch.cutting || [], nameByLen, scale)
      const usedLength = roundLen(placed.reduce((s, p) => s + p.length, 0))
      let usedWithKerf = 0
      placed.forEach((p, idx) => {
        usedWithKerf += idx === 0 ? p.length : p.length + kerf
      })
      usedWithKerf = roundLen(usedWithKerf)
      const waste = Math.max(0, roundLen(stockLength - usedWithKerf))
      for (let n = 0; n < sch.quantity; n++) {
        patterns.push({
          stockLength,
          stockName: sch.material_name || '',
          parts: placed,
          usedLength,
          waste,
          cutCount: placed.length,
        })
      }
    }
  } else if (json.solution) {
    for (const [lenStr, variants] of Object.entries(json.solution)) {
      const stockLength = fromApiUnits(Number(lenStr), scale)
      for (const [count, partMap] of variants) {
        const placed: PlacedPart[] = []
        for (const [pLenStr, qty] of Object.entries(partMap)) {
          const len = fromApiUnits(Number(pLenStr), scale)
          const name = nameByLen.get(Number(pLenStr)) || ''
          for (let k = 0; k < qty; k++) {
            placed.push({ length: len, name, partKey: `${len}|${name}` })
          }
        }
        placed.sort((a, b) => b.length - a.length)
        const usedLength = roundLen(placed.reduce((s, p) => s + p.length, 0))
        let usedWithKerf = 0
        placed.forEach((p, idx) => {
          usedWithKerf += idx === 0 ? p.length : p.length + kerf
        })
        usedWithKerf = roundLen(usedWithKerf)
        const waste = Math.max(0, roundLen(stockLength - usedWithKerf))
        for (let n = 0; n < count; n++) {
          patterns.push({
            stockLength,
            stockName: '',
            parts: placed,
            usedLength,
            waste,
            cutCount: placed.length,
          })
        }
      }
    }
  }

  return patterns
}

function buildSolveResult(
  patterns: CuttingPattern[],
  stocks: StockItem[],
  remainingParts: PartItem[],
): SolveResult {
  const stocksUsedMap = new Map<
    string,
    { length: number; name: string; count: number; totalLength: number }
  >()
  for (const p of patterns) {
    const key = `${p.stockLength}|${p.stockName}`
    const cur = stocksUsedMap.get(key) || {
      length: p.stockLength,
      name: p.stockName,
      count: 0,
      totalLength: 0,
    }
    cur.count += 1
    cur.totalLength = roundLen(cur.totalLength + p.stockLength)
    stocksUsedMap.set(key, cur)
  }

  const totalStockLength = roundLen(patterns.reduce((s, p) => s + p.stockLength, 0))
  const totalPartsLength = roundLen(patterns.reduce((s, p) => s + p.usedLength, 0))
  const wasteLength = roundLen(Math.max(0, totalStockLength - totalPartsLength))
  const usefulPercent = totalStockLength > 0 ? (totalPartsLength / totalStockLength) * 100 : 0
  const wastePercent = totalStockLength > 0 ? (wasteLength / totalStockLength) * 100 : 0

  // Остатки всегда со схем; имя — с заготовки (обрезь…)
  const remMap = new Map<string, { length: number; name: string; count: number }>()
  for (const p of patterns) {
    if (!(p.waste > 0)) continue
    const name = p.stockName || ''
    const key = `${p.waste}|${name}`
    const cur = remMap.get(key)
    if (cur) cur.count += 1
    else remMap.set(key, { length: p.waste, name, count: 1 })
  }

  const usedByLen = new Map<number, number>()
  for (const p of patterns) {
    usedByLen.set(p.stockLength, (usedByLen.get(p.stockLength) || 0) + 1)
  }

  const unusedStocks: SolveResult['unusedStocks'] = []
  const stocksByPriority = [...stocks].sort(
    (a, b) => priorityRank(stockPriorityValue(a)) - priorityRank(stockPriorityValue(b)),
  )
  for (const s of stocksByPriority) {
    if (typeof s.length !== 'number' || !(s.length > 0)) continue
    if (s.quantity === '' || s.quantity === undefined || s.quantity === null) continue
    const limit = Math.floor(Number(s.quantity))
    if (!(limit > 0)) continue
    const len = roundLen(s.length)
    const used = usedByLen.get(len) || 0
    const take = Math.min(used, limit)
    usedByLen.set(len, used - take)
    const left = limit - take
    if (left > 0) unusedStocks.push({ length: len, name: s.name || '', quantity: left })
  }

  const uncutParts = remainingParts
    .filter((p) => {
      const len = partCalcLength(p)
      const qty = typeof p.quantity === 'number' ? p.quantity : 0
      return len > 0 && qty > 0
    })
    .map((p) => ({
      length: partCalcLength(p),
      name: p.name || '',
      quantity: typeof p.quantity === 'number' ? p.quantity : 0,
    }))

  const cutCount = patterns.reduce((sum, p) => {
    if (p.parts.length === 0) return sum
    const between = Math.max(0, p.parts.length - 1)
    const wasteCut = p.waste > 0 ? 1 : 0
    return sum + between + wasteCut
  }, 0)

  return {
    patterns,
    grouped: groupPatternsLocal(patterns),
    stocksUsed: [...stocksUsedMap.values()],
    totalStockLength,
    totalPartsLength,
    usefulPercent,
    wastePercent,
    wasteLength,
    cutCount,
    remainders: [...remMap.values()].sort(
      (a, b) => b.length - a.length || a.name.localeCompare(b.name),
    ),
    uncutParts,
    unusedStocks,
  }
}

/** Подставить имена заготовок из ввода (API их не возвращает). */
function assignStockNames(patterns: CuttingPattern[], stocks: StockItem[]): void {
  const limited = new Map<number, string[]>()
  const anyName = new Map<number, string>()

  for (const s of stocks) {
    if (typeof s.length !== 'number' || !(s.length > 0)) continue
    const len = roundLen(s.length)
    const label = (s.name || '').trim()
    if (label && !anyName.has(len)) anyName.set(len, label)
    const qty = stockQtyForApi(s.quantity)
    if (qty >= UNLIMITED_QTY / 2) {
      if (label) anyName.set(len, label)
      continue
    }
    if (!(qty > 0)) continue
    const list = limited.get(len) || []
    for (let i = 0; i < qty; i++) list.push(label)
    limited.set(len, list)
  }

  for (const p of patterns) {
    if ((p.stockName || '').trim()) continue
    const list = limited.get(roundLen(p.stockLength))
    if (list && list.length) {
      p.stockName = list.shift() || ''
    } else {
      p.stockName = anyName.get(roundLen(p.stockLength)) || ''
    }
  }
}

/** Подставить имена отрезков из ввода (по длине, с учётом кол-ва). */
function assignPartNames(patterns: CuttingPattern[], parts: PartItem[]): void {
  const pool = new Map<number, string[]>()
  for (const p of parts) {
    const len = partCalcLength(p)
    const qty = typeof p.quantity === 'number' ? Math.floor(p.quantity) : 0
    if (!(len > 0) || qty <= 0) continue
    const label = (p.name || '').trim()
    if (!label) continue
    const list = pool.get(roundLen(len)) || []
    for (let i = 0; i < qty; i++) list.push(label)
    pool.set(roundLen(len), list)
  }
  if (!pool.size) return

  for (const pat of patterns) {
    for (const pl of pat.parts) {
      if ((pl.name || '').trim()) continue
      const list = pool.get(roundLen(pl.length))
      if (!list || !list.length) continue
      const name = list.shift() || ''
      pl.name = name
      pl.partKey = `${pl.length}|${name}`
    }
  }
}

/**
 * SmartCut API не знает «очерёдность» — считаем по группам приоритета:
 * сначала очерёдность 1, потом 2…, 0 в конце.
 * После API — локальная переупаковка для меньших остатков.
 */
export async function solveViaSmartCut(
  stocks: StockItem[],
  parts: PartItem[],
  settings: Settings,
  apiToken: string,
): Promise<SolveResult> {
  const token = apiToken.trim()
  if (!token) throw new Error('Не указан API-токен SmartCut.Pro')

  const scale = detectUnitScale(stocks, parts)
  const groups = groupStocksByPriority(stocks)
  if (!groups.length) throw new Error('Нет данных для API: заготовки и отрезки')

  const remaining = clonePartsWithQty(parts)
  if (!remaining.some((p) => (typeof p.quantity === 'number' ? p.quantity : 0) > 0)) {
    throw new Error('Нет данных для API: заготовки и отрезки')
  }

  let allPatterns: CuttingPattern[] = []

  for (const group of groups) {
    const fitting = partsFittingStocks(remaining, group, settings.trimming || 0)
    if (!fitting.length) continue
    if (!anyPartFitsStocks(fitting, group, settings.trimming || 0)) continue

    const passPatterns = await fetchSmartCutPass(group, fitting, settings, token, scale, 2)
    if (!passPatterns.length) continue
    assignStockNames(passPatterns, group)
    assignPartNames(passPatterns, fitting)
    allPatterns.push(...passPatterns)
    subtractUsedParts(remaining, passPatterns)
  }

  if (!allPatterns.length) {
    throw new Error('SmartCut API: не удалось разместить отрезки на указанных заготовках')
  }

  allPatterns = improvePatternsFill(allPatterns, settings)
  assignStockNames(allPatterns, stocks)
  assignPartNames(allPatterns, parts)
  return buildSolveResult(allPatterns, stocks, remaining)
}
