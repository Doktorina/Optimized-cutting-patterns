/**
 * Алгоритм линейного (1D) раскроя.
 * Вход: заготовки + отрезки + настройки (пропил, торцовка).
 * Выход: SolveResult — схемы, остатки, % пользы.
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
import { asMeterLength, partCalcLength, roundLen } from '../types'

type PartType = {
  length: number
  name: string
  partKey: string
  remaining: number
}

type StockOption = {
  length: number
  name: string
  priority: number
  remaining: number
}

function effectiveCapacity(stockLength: number, trimming: number): number {
  return Math.max(0, stockLength - trimming)
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

/** Очерёдность: 1,2,3… по порядку; 0 = без приоритета (в конце). */
function priorityRank(p: number): number {
  return p > 0 ? p : Number.MAX_SAFE_INTEGER
}

function prepareStocks(stocks: StockItem[], settings: Settings): StockOption[] {
  const options: StockOption[] = stocks
    .filter((s) => typeof s.length === 'number' && s.length > 0)
    .map((s) => ({
      length: roundLen(s.length as number),
      name: s.name,
      priority: typeof s.priority === 'number' ? s.priority : Number(s.priority) || 0,
      remaining: (() => {
        if (s.quantity === '' || s.quantity === undefined || s.quantity === null) return Infinity
        const q = Math.floor(Number(s.quantity))
        return Number.isFinite(q) && q > 0 ? q : 0
      })(),
    }))
    .filter((s) => s.remaining > 0 && s.length > 0)

  if (settings.sortStocks === 'asc') {
    options.sort((a, b) => a.length - b.length || priorityRank(a.priority) - priorityRank(b.priority))
  } else if (settings.sortStocks === 'desc') {
    options.sort((a, b) => b.length - a.length || priorityRank(a.priority) - priorityRank(b.priority))
  } else {
    // none / priority — сначала очерёдность 1,2,3…, потом 0
    options.sort(
      (a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.length - a.length,
    )
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
    const label = p.name
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

type PackScore = {
  parts: PlacedPart[]
  usedLen: number
  usedWithKerf: number
  waste: number
  /** Мелкий «мусор» < usefulMin — штрафуем сильнее */
  scrap: number
}

function materializeCounts(types: PartType[], counts: number[]): PlacedPart[] {
  const ordered = types
    .map((t, i) => ({ t, c: counts[i] || 0 }))
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

function scorePack(
  parts: PlacedPart[],
  capacity: number,
  kerf: number,
  usefulMin = 0,
): PackScore {
  let usedWithKerf = 0
  parts.forEach((p, idx) => {
    usedWithKerf += idx === 0 ? p.length : p.length + kerf
  })
  usedWithKerf = roundLen(usedWithKerf)
  const usedLen = roundLen(parts.reduce((s, p) => s + p.length, 0))
  const waste = Math.max(0, roundLen(capacity - usedWithKerf))
  const scrap =
    usefulMin > 0 && waste > 1e-9 && waste < usefulMin - 1e-9 ? waste : 0
  return {
    parts,
    usedLen,
    usedWithKerf,
    waste,
    scrap,
  }
}

function nextSpace(pieceCount: number, length: number, kerf: number): number {
  return pieceCount === 0 ? length : length + kerf
}

function toUnits(n: number): number {
  return Math.round(n * 1000)
}

/**
 * Набивка заготовки: максимум полезной длины (меньше остаток).
 * Обязательные minCounts + FFD / best-fit / DP.
 */
function packBar(
  capacity: number,
  types: PartType[],
  kerf: number,
  minCounts?: number[],
  usefulMin = 0,
): PlacedPart[] {
  const mins = minCounts || types.map(() => 0)
  for (let i = 0; i < types.length; i++) {
    if (mins[i] > types[i].remaining) return []
  }

  const placeMins = (): { counts: number[]; used: number; n: number } | null => {
    const counts = new Array(types.length).fill(0)
    let used = 0
    let n = 0
    for (let i = 0; i < types.length; i++) {
      for (let k = 0; k < mins[i]; k++) {
        const sp = nextSpace(n, types[i].length, kerf)
        if (used + sp > capacity + 1e-9) return null
        used = roundLen(used + sp)
        n += 1
        counts[i] += 1
      }
    }
    return { counts, used, n }
  }

  const fillFfd = (base: { counts: number[]; used: number; n: number }): number[] => {
    const counts = base.counts.slice()
    let used = base.used
    let n = base.n
    const order = types
      .map((t, i) => ({ i, len: t.length }))
      .sort((a, b) => b.len - a.len)
      .map((x) => x.i)

    for (const i of order) {
      while (counts[i] < types[i].remaining) {
        const sp = nextSpace(n, types[i].length, kerf)
        if (used + sp > capacity + 1e-9) break
        used = roundLen(used + sp)
        n += 1
        counts[i] += 1
      }
    }
    return counts
  }

  const fillBestFit = (base: { counts: number[]; used: number; n: number }): number[] => {
    const counts = base.counts.slice()
    let used = base.used
    let n = base.n
    for (;;) {
      let bestI = -1
      let bestWaste = Infinity
      for (let i = 0; i < types.length; i++) {
        if (counts[i] >= types[i].remaining) continue
        const sp = nextSpace(n, types[i].length, kerf)
        if (used + sp > capacity + 1e-9) continue
        const waste = capacity - (used + sp)
        if (
          waste < bestWaste - 1e-9 ||
          (Math.abs(waste - bestWaste) < 1e-9 &&
            (bestI < 0 || types[i].length > types[bestI].length))
        ) {
          bestWaste = waste
          bestI = i
        }
      }
      if (bestI < 0) break
      const sp = nextSpace(n, types[bestI].length, kerf)
      used = roundLen(used + sp)
      n += 1
      counts[bestI] += 1
    }
    return counts
  }

  /**
   * Knapsack в тысячных: макс. сумма длин.
   * Пустая база: ёмкость capacity+kerf, кусок = length+kerf.
   * Уже есть куски: ёмкость capacity−used, каждый новый = length+kerf.
   */
  const fillDp = (base: { counts: number[]; used: number; n: number }): number[] | null => {
    const kerfU = toUnits(kerf)
    const remU =
      base.n === 0
        ? toUnits(capacity) + kerfU
        : toUnits(capacity) - toUnits(base.used)
    if (remU <= 0) return base.counts.slice()

    const active = types
      .map((t, i) => ({
        i,
        cost: toUnits(t.length) + kerfU,
        value: toUnits(t.length),
        max: Math.max(0, t.remaining - base.counts[i]),
      }))
      .filter((x) => x.max > 0 && x.cost > 0 && x.cost <= remU)

    if (!active.length) return base.counts.slice()
    if (remU > 25000 || active.length > 40) return null

    let dp = new Int32Array(remU + 1).fill(-1)
    dp[0] = 0
    const takeLayers: Int16Array[] = []

    for (const item of active) {
      const next = dp.slice()
      const take = new Int16Array(remU + 1)
      for (let w = 0; w <= remU; w++) {
        if (dp[w] < 0) continue
        const maxK = Math.min(item.max, Math.floor((remU - w) / item.cost))
        for (let k = 1; k <= maxK; k++) {
          const nw = w + item.cost * k
          const cand = dp[w] + item.value * k
          if (cand > next[nw]) {
            next[nw] = cand
            take[nw] = k
          }
        }
      }
      takeLayers.push(take)
      dp = next
    }

    let bestW = 0
    let bestVal = 0
    for (let w = 0; w <= remU; w++) {
      if (dp[w] > bestVal || (dp[w] === bestVal && w > bestW)) {
        bestVal = dp[w]
        bestW = w
      }
    }
    if (bestVal <= 0) return base.counts.slice()

    const counts = base.counts.slice()
    let w = bestW
    for (let ai = active.length - 1; ai >= 0; ai--) {
      const k = takeLayers[ai][w]
      if (k > 0) {
        counts[active[ai].i] += k
        w -= active[ai].cost * k
      }
    }
    return counts
  }

  const base = placeMins()
  if (!base) return []

  const candidateCounts: number[][] = [fillFfd(base), fillBestFit(base)]
  const dpCounts = fillDp(base)
  if (dpCounts) candidateCounts.push(dpCounts)

  // Ещё раз: FFD → добивка DP остатка
  {
    const afterFfd = fillFfd(base)
    let used = 0
    let n = 0
    for (let i = 0; i < types.length; i++) {
      for (let k = 0; k < afterFfd[i]; k++) {
        used = roundLen(used + nextSpace(n, types[i].length, kerf))
        n += 1
      }
    }
    const refined = fillDp({ counts: afterFfd, used, n })
    if (refined) candidateCounts.push(refined)
  }

  let bestParts: PlacedPart[] = []
  let bestScore: PackScore | null = null

  for (const counts of candidateCounts) {
    if (!counts.some((c) => c > 0)) continue
    const parts = materializeCounts(types, counts)
    const score = scorePack(parts, capacity, kerf, usefulMin)
    if (!bestScore || comparePack(score, bestScore) < 0) {
      bestScore = score
      bestParts = parts
    }
  }

  return bestParts
}

function comparePack(a: PackScore, b: PackScore): number {
  // Сначала убираем мелкий мусор, потом минимизируем остаток, потом максимум пользы
  if (a.scrap < b.scrap - 1e-9) return -1
  if (a.scrap > b.scrap + 1e-9) return 1
  if (a.waste < b.waste - 1e-9) return -1
  if (a.waste > b.waste + 1e-9) return 1
  if (a.usedLen > b.usedLen + 1e-9) return -1
  if (a.usedLen < b.usedLen - 1e-9) return 1
  if (a.parts.length > b.parts.length) return -1
  if (a.parts.length < b.parts.length) return 1
  return 0
}

/**
 * Отрезки, которые ещё можно положить на заготовки с более ранней очерёдностью —
 * их не берём на текущую (сначала вырезаем приоритетные заготовки целиком).
 */
function typesForStockPriority(
  types: PartType[],
  options: StockOption[],
  stockPriority: number,
  trimming: number,
): PartType[] {
  const earlier = options.filter(
    (o) => o.remaining > 0 && priorityRank(o.priority) < priorityRank(stockPriority),
  )
  if (!earlier.length) return types

  return types.map((t) => {
    if (t.remaining <= 0) return t
    const fitsEarlier = earlier.some(
      (o) => t.length <= effectiveCapacity(o.length, trimming) + 1e-9,
    )
    return fitsEarlier ? { ...t, remaining: 0 } : t
  })
}

function pickStockForPack(
  options: StockOption[],
  types: PartType[],
  trimming: number,
  kerf: number,
  usefulMin = 0,
): { stockIdx: number; parts: PlacedPart[] } | null {
  let best: { stockIdx: number; parts: PlacedPart[]; score: PackScore } | null = null

  if (!types.some((t) => t.remaining > 0)) return null

  // Сначала очерёдность 1, потом 2…; 0 — после всех.
  // Пока на приоритетной заготовке ещё что-то лезет — режем только её.
  const feasibleIdx: number[] = []
  for (let i = 0; i < options.length; i++) {
    const opt = options[i]
    if (opt.remaining <= 0) continue
    const available = typesForStockPriority(types, options, opt.priority, trimming)
    const cap = effectiveCapacity(opt.length, trimming)
    if (available.some((t) => t.remaining > 0 && t.length <= cap + 1e-9)) {
      feasibleIdx.push(i)
    }
  }
  if (!feasibleIdx.length) return null

  const bestRank = Math.min(...feasibleIdx.map((i) => priorityRank(options[i].priority)))
  const pool = feasibleIdx.filter((i) => priorityRank(options[i].priority) === bestRank)

  for (const i of pool) {
    const opt = options[i]
    const available = typesForStockPriority(types, options, opt.priority, trimming)
    const cap = effectiveCapacity(opt.length, trimming)
    const fitRanked = available
      .map((t, idx) => ({ t, idx }))
      .filter((x) => x.t.remaining > 0 && x.t.length <= cap + 1e-9)
      .sort((a, b) => b.t.length - a.t.length)

    if (!fitRanked.length) continue

    const candidates: PlacedPart[][] = []

    // Максимально плотная набивка без принуждения — выше польза
    const free = packBar(cap, available, kerf, undefined, usefulMin)
    if (free.length) candidates.push(free)

    // Варианты с обязательным крупным / парой — на случай лучшего стыка
    for (const { idx } of fitRanked.slice(0, 3)) {
      const mins = available.map(() => 0)
      mins[idx] = 1
      const packed = packBar(cap, available, kerf, mins, usefulMin)
      if (packed.length) candidates.push(packed)

      if (available[idx].remaining >= 2) {
        const mins2 = available.map(() => 0)
        mins2[idx] = 2
        const packed2 = packBar(cap, available, kerf, mins2, usefulMin)
        if (packed2.length) candidates.push(packed2)
      }
    }

    if (fitRanked.length > 1) {
      const minsPair = available.map(() => 0)
      minsPair[fitRanked[0].idx] = 1
      minsPair[fitRanked[1].idx] = 1
      const withPair = packBar(cap, available, kerf, minsPair, usefulMin)
      if (withPair.length) candidates.push(withPair)
    }

    for (const parts of candidates) {
      const score = scorePack(parts, cap, kerf, usefulMin)
      if (!best || comparePack(score, best.score) < 0) {
        best = { stockIdx: i, parts, score }
      }
    }
  }

  if (!best) return null
  return { stockIdx: best.stockIdx, parts: best.parts }
}

/** Сколько раз подряд можно повторить ту же схему. */
function patternRepeatLimit(
  parts: PlacedPart[],
  types: PartType[],
  stockRemaining: number,
): number {
  if (parts.length === 0 || stockRemaining <= 0) return 0
  const need = new Map<string, number>()
  for (const p of parts) need.set(p.partKey, (need.get(p.partKey) || 0) + 1)
  let times = Math.floor(stockRemaining)
  for (const [key, cnt] of need) {
    const t = types.find((x) => x.partKey === key)
    if (!t) return 0
    times = Math.min(times, Math.floor(t.remaining / cnt))
  }
  return Math.max(0, times)
}

/**
 * Переупаковать схемы одной длины заготовки плотнее (меньше остатков / меньше штук).
 * Не меняет набор отрезков — только раскладку по тем же длинам.
 */
export function improvePatternsFill(
  patterns: CuttingPattern[],
  settings: Settings,
): CuttingPattern[] {
  if (patterns.length <= 1 || patterns.length > 120) return patterns

  const kerf = Math.max(0, settings.bladeKerf || 0)
  const trimming = Math.max(0, settings.trimming || 0)
  const usefulMin = Math.max(0, settings.usefulRemainderMin || 0)

  const groups = new Map<string, CuttingPattern[]>()
  for (const p of patterns) {
    const key = `${p.stockLength}|${p.stockName || ''}|${p.stockPriority ?? 0}`
    const list = groups.get(key) || []
    list.push(p)
    groups.set(key, list)
  }

  const out: CuttingPattern[] = []
  for (const [, group] of groups) {
    if (group.length === 1) {
      out.push(group[0])
      continue
    }

    const stockLength = group[0].stockLength
    const stockName = group[0].stockName
    const stockPriority = group[0].stockPriority
    const cap = effectiveCapacity(stockLength, trimming)

    const typeMap = new Map<string, PartType>()
    for (const pat of group) {
      for (const pl of pat.parts) {
        const key = pl.partKey || `${roundLen(pl.length)}|${pl.name || ''}`
        const cur = typeMap.get(key)
        if (cur) cur.remaining += 1
        else {
          typeMap.set(key, {
            length: roundLen(pl.length),
            name: pl.name || '',
            partKey: key,
            remaining: 1,
          })
        }
      }
    }
    const types = [...typeMap.values()].sort((a, b) => b.length - a.length)
    const totalParts = types.reduce((s, t) => s + t.remaining, 0)

    const rebuilt: CuttingPattern[] = []
    const work = types.map((t) => ({ ...t }))
    const maxBars = group.length
    while (work.some((t) => t.remaining > 0) && rebuilt.length < maxBars) {
      const packed = packBar(cap, work, kerf, undefined, usefulMin)
      if (!packed.length) break
      const need = new Map<string, number>()
      for (const p of packed) need.set(p.partKey, (need.get(p.partKey) || 0) + 1)
      for (const [key, cnt] of need) {
        const t = work.find((x) => x.partKey === key)
        if (t) t.remaining -= cnt
      }
      const roundedParts = packed.map((p) => ({ ...p, length: roundLen(p.length) }))
      const partsLength = roundLen(roundedParts.reduce((s, p) => s + p.length, 0))
      let usedWithKerf = 0
      roundedParts.forEach((p, idx) => {
        usedWithKerf += idx === 0 ? p.length : p.length + kerf
      })
      usedWithKerf = roundLen(usedWithKerf)
      rebuilt.push({
        stockLength,
        stockName,
        stockPriority,
        parts: roundedParts,
        usedLength: partsLength,
        waste: Math.max(0, roundLen(cap - usedWithKerf)),
        cutCount: roundedParts.length,
      })
    }

    const left = work.reduce((s, t) => s + Math.max(0, t.remaining), 0)
    if (left > 0 || rebuilt.reduce((s, p) => s + p.parts.length, 0) !== totalParts) {
      out.push(...group)
      continue
    }

    const oldWaste = roundLen(group.reduce((s, p) => s + p.waste, 0))
    const newWaste = roundLen(rebuilt.reduce((s, p) => s + p.waste, 0))
    const oldScrap = group.reduce(
      (s, p) => s + (usefulMin > 0 && p.waste > 0 && p.waste < usefulMin ? p.waste : 0),
      0,
    )
    const newScrap = rebuilt.reduce(
      (s, p) => s + (usefulMin > 0 && p.waste > 0 && p.waste < usefulMin ? p.waste : 0),
      0,
    )

    const better =
      rebuilt.length < group.length ||
      newScrap < oldScrap - 1e-9 ||
      (Math.abs(newScrap - oldScrap) < 1e-9 && newWaste < oldWaste - 1e-9)

    out.push(...(better ? rebuilt : group))
  }

  return out
}

/** Главный расчёт 1D: повторять лучшую раскладку, пока есть отрезки и заготовки. */
export function solveCutting(
  stocks: StockItem[],
  parts: PartItem[],
  settings: Settings,
): SolveResult {
  const kerf = Math.max(0, settings.bladeKerf || 0)
  const trimming = Math.max(0, settings.trimming || 0)
  const usefulMin = Math.max(0, settings.usefulRemainderMin || 0)

  const types = buildPartTypes(parts, settings)
  const stockOptions = prepareStocks(stocks, settings)
  const initialStockCounts = new Map(
    stockOptions.map((s) => [`${s.length}|${s.name}`, { ...s, initial: s.remaining }]),
  )

  let patterns: CuttingPattern[] = []

  while (types.some((t) => t.remaining > 0)) {
    const pick = pickStockForPack(stockOptions, types, trimming, kerf, usefulMin)
    if (!pick) break

    const opt = stockOptions[pick.stockIdx]
    const placed = pick.parts
    const times = patternRepeatLimit(placed, types, opt.remaining)
    if (times <= 0) break

    const roundedParts = placed.map((p) => ({ ...p, length: roundLen(p.length) }))
    const partsLength = roundLen(roundedParts.reduce((s, p) => s + p.length, 0))
    let usedWithKerf = 0
    roundedParts.forEach((p, idx) => {
      usedWithKerf += idx === 0 ? p.length : p.length + kerf
    })
    usedWithKerf = roundLen(usedWithKerf)
    const cap = effectiveCapacity(opt.length, trimming)
    const waste = Math.max(0, roundLen(cap - usedWithKerf))

    const need = new Map<string, number>()
    for (const p of placed) need.set(p.partKey, (need.get(p.partKey) || 0) + 1)

    for (let n = 0; n < times; n++) {
      opt.remaining -= 1
      for (const [key, cnt] of need) {
        const t = types.find((x) => x.partKey === key)
        if (t) t.remaining -= cnt
      }
      patterns.push({
        stockLength: opt.length,
        stockName: opt.name,
        stockPriority: opt.priority,
        parts: roundedParts,
        usedLength: partsLength,
        waste,
        cutCount: roundedParts.length,
      })
    }
  }

  patterns = improvePatternsFill(patterns, settings)

  // Сначала по очерёдности (1 → 2 → 0), внутри — одинаковые схемы рядом
  patterns.sort((a, b) => {
    const pr = priorityRank(a.stockPriority ?? 0) - priorityRank(b.stockPriority ?? 0)
    if (pr !== 0) return pr
    const sa = a.parts.map((p) => p.length).join(',')
    const sb = b.parts.map((p) => p.length).join(',')
    if (sa !== sb) return sa.localeCompare(sb)
    return b.stockLength - a.stockLength
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
    cur.totalLength = roundLen(cur.totalLength + p.stockLength)
    stocksUsedMap.set(key, cur)
  }
  const stocksUsed = [...stocksUsedMap.values()]

  const totalStockLength = roundLen(patterns.reduce((s, p) => s + p.stockLength, 0))
  const totalPartsLength = roundLen(patterns.reduce((s, p) => s + p.usedLength, 0))
  const wasteLength = roundLen(Math.max(0, totalStockLength - totalPartsLength))
  const usefulPercent = totalStockLength > 0 ? (totalPartsLength / totalStockLength) * 100 : 0
  const wastePercent = totalStockLength > 0 ? (wasteLength / totalStockLength) * 100 : 0

  const remMap = new Map<string, { length: number; name: string; count: number }>()
  for (const p of patterns) {
    if (!(p.waste > 0)) continue
    const name = p.stockName || ''
    const key = `${p.waste}|${name}`
    const cur = remMap.get(key)
    if (cur) cur.count += 1
    else remMap.set(key, { length: p.waste, name, count: 1 })
  }
  const remainders = [...remMap.values()].sort(
    (a, b) => b.length - a.length || a.name.localeCompare(b.name),
  )

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
  const s = String(v).trim().replace(/\s/g, '')
  // одна запятая — десятичная (7,900 → 7.9), не тысячи
  const normalized =
    s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, '')
  const n = Number(normalized)
  if (!Number.isFinite(n)) return ''
  return Math.round(n * 1000) / 1000
}

function normalizePart(p: PartItem): PartItem {
  const length = asNum(p.length)
  return {
    ...p,
    length: length === '' ? '' : asMeterLength(length),
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
  return noLen && noQty && !n.name
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
