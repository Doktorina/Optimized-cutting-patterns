/**
 * Алгоритм раскроя листа (2D).
 *
 * solveSheetVariants() → несколько вариантов укладки (MaxRects, полки…),
 * отсортированных: сначала лучший (меньше неразмещённых → меньше листов → выше польза).
 * Пропил (kerf): деталь кладётся как (w+kerf)×(h+kerf) в лист (W+kerf)×(H+kerf).
 */

export type SheetStock = {
  width: number
  height: number
  quantity: number | null // null = без лимита
  name: string
}

export type SheetPartDef = {
  id: string
  width: number
  height: number
  quantity: number
  name: string
  allowRotate: boolean
}

export type PlacedRect = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotated: boolean
}

export type PackedSheet = {
  sheetWidth: number
  sheetHeight: number
  sheetName: string
  parts: PlacedRect[]
  usedArea: number
  wasteArea: number
  usefulPercent: number
}

export type PackVariant = {
  id: string
  title: string
  description: string
  sheets: PackedSheet[]
  sheetsUsed: number
  /** Суммарная площадь размещённых деталей */
  totalPartsArea: number
  /** Суммарная площадь использованных листов */
  totalSheetArea: number
  /** КПИ = площадь деталей / площадь листов × 100 */
  totalUsefulPercent: number
  totalWasteArea: number
  totalWastePercent: number
  /** Доля заполнения ограничивающего прямоугольника укладки (для выбора лучшего при равном КПИ) */
  compactness: number
  unplacedCount: number
  unplaced: { name: string; width: number; height: number; quantity: number }[]
}

type FreeRect = { x: number; y: number; width: number; height: number }

type Piece = {
  id: string
  name: string
  width: number
  height: number
  allowRotate: boolean
  key: string
}

function expandPieces(parts: SheetPartDef[]): Piece[] {
  const out: Piece[] = []
  for (const p of parts) {
    for (let i = 0; i < p.quantity; i++) {
      out.push({
        id: `${p.id}_${i}`,
        name: p.name || `${p.width}×${p.height}`,
        width: p.width,
        height: p.height,
        allowRotate: p.allowRotate,
        key: p.id,
      })
    }
  }
  return out
}

function orientations(piece: Piece): { w: number; h: number; rotated: boolean }[] {
  const opts = [{ w: piece.width, h: piece.height, rotated: false }]
  if (piece.allowRotate && piece.width !== piece.height) {
    opts.push({ w: piece.height, h: piece.width, rotated: true })
  }
  return opts
}

function pieceArea(p: Piece): number {
  return p.width * p.height
}

function overlaps(a: FreeRect, b: FreeRect): boolean {
  return !(
    a.x >= b.x + b.width ||
    a.x + a.width <= b.x ||
    a.y >= b.y + b.height ||
    a.y + a.height <= b.y
  )
}

function pruneFreeRects(rects: FreeRect[]): FreeRect[] {
  const filtered = rects.filter((r) => r.width > 0.5 && r.height > 0.5)
  return filtered.filter(
    (a, i) =>
      !filtered.some(
        (b, j) =>
          i !== j &&
          a.x >= b.x &&
          a.y >= b.y &&
          a.x + a.width <= b.x + b.width &&
          a.y + a.height <= b.y + b.height,
      ),
  )
}

/**
 * Разрезает свободный прямоугольник занятой зоной (MaxRects).
 * Границы реза — по occupied, чтобы между деталями оставался пропил.
 */
function splitFreeNode(freeNode: FreeRect, used: FreeRect): FreeRect[] {
  if (!overlaps(freeNode, used)) return [freeNode]

  const out: FreeRect[] = []

  // Сверху от used (меньший y)
  if (used.y > freeNode.y && used.y < freeNode.y + freeNode.height) {
    out.push({
      x: freeNode.x,
      y: freeNode.y,
      width: freeNode.width,
      height: used.y - freeNode.y,
    })
  }
  // Снизу от used (больший y)
  if (used.y + used.height < freeNode.y + freeNode.height) {
    out.push({
      x: freeNode.x,
      y: used.y + used.height,
      width: freeNode.width,
      height: freeNode.y + freeNode.height - (used.y + used.height),
    })
  }
  // Слева
  if (used.x > freeNode.x && used.x < freeNode.x + freeNode.width) {
    out.push({
      x: freeNode.x,
      y: freeNode.y,
      width: used.x - freeNode.x,
      height: freeNode.height,
    })
  }
  // Справа
  if (used.x + used.width < freeNode.x + freeNode.width) {
    out.push({
      x: used.x + used.width,
      y: freeNode.y,
      width: freeNode.x + freeNode.width - (used.x + used.width),
      height: freeNode.height,
    })
  }

  return out
}

type ScoreMode = 'bssf' | 'baf'

/**
 * MaxRects BSSF / Best Area Fit.
 * Пропил: упаковываем (w+kerf)×(h+kerf) в лист (W+kerf)×(H+kerf),
 * на схеме рисуем реальный размер w×h — между деталями зазор ≥ kerf.
 */
function packMaxRects(
  sheetW: number,
  sheetH: number,
  pieces: Piece[],
  kerf: number,
  mode: ScoreMode = 'bssf',
): { placed: PlacedRect[]; leftover: Piece[] } {
  const gap = Math.max(0, kerf)
  const binW = sheetW + gap
  const binH = sheetH + gap
  const free: FreeRect[] = [{ x: 0, y: 0, width: binW, height: binH }]
  const placed: PlacedRect[] = []
  const leftover: Piece[] = []
  const remaining = [...pieces].sort((a, b) => pieceArea(b) - pieceArea(a))

  const fits = (fr: FreeRect, w: number, h: number) =>
    w <= fr.width + 1e-9 && h <= fr.height + 1e-9

  while (remaining.length) {
    let bestIdx = -1
    let bestOri: { w: number; h: number; rotated: boolean } | null = null
    let bestFr: FreeRect | null = null
    let bestPrimary = Infinity
    let bestSecondary = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const piece = remaining[i]
      for (const ori of orientations(piece)) {
        const packW = ori.w + gap
        const packH = ori.h + gap
        for (const fr of free) {
          if (!fits(fr, packW, packH)) continue
          // Реальная деталь не должна выходить за край листа
          if (fr.x + ori.w > sheetW + 1e-9 || fr.y + ori.h > sheetH + 1e-9) continue

          let primary: number
          let secondary: number
          if (mode === 'baf') {
            primary = fr.width * fr.height - packW * packH
            secondary = Math.min(fr.width - packW, fr.height - packH)
          } else {
            primary = Math.min(fr.width - packW, fr.height - packH)
            secondary = Math.max(fr.width - packW, fr.height - packH)
          }

          const tieY = fr.y
          const tieX = fr.x
          const better =
            primary < bestPrimary - 1e-9 ||
            (Math.abs(primary - bestPrimary) < 1e-9 && secondary < bestSecondary - 1e-9) ||
            (Math.abs(primary - bestPrimary) < 1e-9 &&
              Math.abs(secondary - bestSecondary) < 1e-9 &&
              (tieY < (bestFr?.y ?? Infinity) - 1e-9 ||
                (Math.abs(tieY - (bestFr?.y ?? 0)) < 1e-9 && tieX < (bestFr?.x ?? Infinity))))

          if (better) {
            bestPrimary = primary
            bestSecondary = secondary
            bestIdx = i
            bestOri = ori
            bestFr = fr
          }
        }
      }
    }

    if (bestIdx < 0 || !bestOri || !bestFr) {
      leftover.push(...remaining)
      break
    }

    const piece = remaining.splice(bestIdx, 1)[0]
    const rect: PlacedRect = {
      id: piece.id,
      name: piece.name,
      x: bestFr.x,
      y: bestFr.y,
      width: bestOri.w,
      height: bestOri.h,
      rotated: bestOri.rotated,
    }
    placed.push(rect)

    // В свободном пространстве «занимаем» деталь + пропил
    const used: FreeRect = {
      x: rect.x,
      y: rect.y,
      width: bestOri.w + gap,
      height: bestOri.h + gap,
    }
    const nextFree: FreeRect[] = []
    for (const fr of free) {
      nextFree.push(...splitFreeNode(fr, used))
    }
    free.length = 0
    free.push(...pruneFreeRects(nextFree))
  }

  return { placed, leftover }
}

/** Полки (горизонтальные уровни) */
function packShelves(
  sheetW: number,
  sheetH: number,
  pieces: Piece[],
  kerf: number,
  sortMode: 'height' | 'area' | 'width',
): { placed: PlacedRect[]; leftover: Piece[] } {
  const sorted = [...pieces].sort((a, b) => {
    if (sortMode === 'area') return b.width * b.height - a.width * a.height
    if (sortMode === 'width') return b.width - a.width || b.height - a.height
    return Math.max(b.width, b.height) - Math.max(a.width, a.height)
  })

  const placed: PlacedRect[] = []
  const leftover: Piece[] = []
  let shelfY = 0
  let shelfH = 0
  let cursorX = 0
  const gap = Math.max(0, kerf)

  for (const piece of sorted) {
    const oris = orientations(piece).filter((o) => o.w <= sheetW + 1e-9 && o.h <= sheetH + 1e-9)
    if (!oris.length) {
      leftover.push(piece)
      continue
    }

    const roomX = () => (cursorX <= 0 ? sheetW : sheetW - cursorX - gap)
    const roomH = () => (shelfH > 0 ? shelfH : sheetH - shelfY)

    // Ориентация, которая влезает в текущую полосу
    let chosen =
      oris.find((o) => o.w <= roomX() + 1e-9 && o.h <= roomH() + 1e-9) || null

    // Не влезла в текущую полосу по ширине/высоте полосы → новая полоса
    if (!chosen && cursorX > 0) {
      const nextY = shelfY + shelfH + gap
      const nextRoomH = sheetH - nextY
      chosen =
        oris
          .filter((o) => o.w <= sheetW + 1e-9 && o.h <= nextRoomH + 1e-9)
          .sort((a, b) => a.h - b.h || a.w - b.w)[0] || null
      if (chosen) {
        shelfY = nextY
        cursorX = 0
        shelfH = 0
      }
    }

    // Первая деталь полосы / старт листа
    if (!chosen && cursorX === 0) {
      chosen =
        oris
          .filter((o) => o.h <= sheetH - shelfY + 1e-9)
          .sort((a, b) => a.h - b.h || a.w - b.w)[0] || null
    }

    if (!chosen) {
      leftover.push(piece)
      continue
    }

    if (shelfY + chosen.h > sheetH + 1e-9) {
      leftover.push(piece)
      continue
    }

    if (cursorX === 0) shelfH = chosen.h
    else shelfH = Math.max(shelfH, chosen.h)

    const x = cursorX
    placed.push({
      id: piece.id,
      name: piece.name,
      x,
      y: shelfY,
      width: chosen.w,
      height: chosen.h,
      rotated: chosen.rotated,
    })
    cursorX = x + chosen.w + gap
  }

  return { placed, leftover }
}

function packingCompactness(placed: PlacedRect[]): number {
  if (!placed.length) return 0
  let maxX = 0
  let maxY = 0
  let used = 0
  for (const p of placed) {
    maxX = Math.max(maxX, p.x + p.width)
    maxY = Math.max(maxY, p.y + p.height)
    used += p.width * p.height
  }
  const bbox = maxX * maxY
  return bbox > 0 ? used / bbox : 0
}

function makeSheet(stock: SheetStock, placed: PlacedRect[]): PackedSheet {
  const area = stock.width * stock.height
  const usedArea = placed.reduce((s, p) => s + p.width * p.height, 0)
  return {
    sheetWidth: stock.width,
    sheetHeight: stock.height,
    sheetName: stock.name,
    parts: placed,
    usedArea,
    wasteArea: Math.max(0, area - usedArea),
    usefulPercent: area > 0 ? (usedArea / area) * 100 : 0,
  }
}

function packAllSheets(
  stock: SheetStock,
  pieces: Piece[],
  kerf: number,
  packOne: (
    w: number,
    h: number,
    pcs: Piece[],
    kerf: number,
  ) => { placed: PlacedRect[]; leftover: Piece[] },
): { sheets: PackedSheet[]; unplaced: Piece[] } {
  const sheets: PackedSheet[] = []
  let remaining = [...pieces]
  let usedCount = 0
  const limit = stock.quantity == null ? 500 : stock.quantity

  while (remaining.length && usedCount < limit) {
    const { placed, leftover } = packOne(stock.width, stock.height, remaining, kerf)
    if (!placed.length) {
      remaining = leftover
      break
    }
    sheets.push(makeSheet(stock, placed))
    remaining = leftover
    usedCount++
  }

  return { sheets, unplaced: remaining }
}

function summarize(
  id: string,
  title: string,
  description: string,
  sheets: PackedSheet[],
  unplaced: Piece[],
): PackVariant {
  const totalSheetArea = sheets.reduce((s, sh) => s + sh.sheetWidth * sh.sheetHeight, 0)
  const totalPartsArea = sheets.reduce((s, sh) => s + sh.usedArea, 0)
  const totalWasteArea = Math.max(0, totalSheetArea - totalPartsArea)
  const totalUsefulPercent = totalSheetArea > 0 ? (totalPartsArea / totalSheetArea) * 100 : 0
  const totalWastePercent = totalSheetArea > 0 ? (totalWasteArea / totalSheetArea) * 100 : 0
  const compactness =
    sheets.length > 0
      ? sheets.reduce((s, sh) => s + packingCompactness(sh.parts), 0) / sheets.length
      : 0
  const unplacedMap = new Map<
    string,
    { name: string; width: number; height: number; quantity: number }
  >()
  for (const u of unplaced) {
    const key = `${u.width}x${u.height}|${u.name}`
    const cur = unplacedMap.get(key) || {
      name: u.name,
      width: u.width,
      height: u.height,
      quantity: 0,
    }
    cur.quantity++
    unplacedMap.set(key, cur)
  }
  const unplacedList = [...unplacedMap.values()]
  return {
    id,
    title,
    description,
    sheets,
    sheetsUsed: sheets.length,
    totalPartsArea,
    totalSheetArea,
    totalUsefulPercent,
    totalWasteArea,
    totalWastePercent,
    compactness,
    unplacedCount: unplacedList.reduce((s, u) => s + u.quantity, 0),
    unplaced: unplacedList,
  }
}

/** Собрать варианты укладки и отсортировать: лучший первым. */
export function solveSheetVariants(
  stock: SheetStock,
  parts: SheetPartDef[],
  kerf: number,
): PackVariant[] {
  const pieces = expandPieces(parts.filter((p) => p.width > 0 && p.height > 0 && p.quantity > 0))
  if (!pieces.length || stock.width <= 0 || stock.height <= 0) return []

  const a = packAllSheets(stock, pieces, kerf, (w, h, pcs, k) => packMaxRects(w, h, pcs, k, 'bssf'))
  const b = packAllSheets(stock, pieces, kerf, (w, h, pcs, k) => packMaxRects(w, h, pcs, k, 'baf'))
  const c = packAllSheets(stock, pieces, kerf, (w, h, pcs, k) => packShelves(w, h, pcs, k, 'height'))
  const d = packAllSheets(stock, pieces, kerf, (w, h, pcs, k) => packShelves(w, h, pcs, k, 'area'))

  const variants = [
    summarize(
      'maxrects-bssf',
      'Плотная укладка',
      'Максимум деталей на листе, минимум отходов. Детали могут стоять вразброс — удобно для станка и ручной разметки.',
      a.sheets,
      a.unplaced,
    ),
    summarize(
      'maxrects-baf',
      'С крупными остатками',
      'Старается оставить цельные свободные зоны — удобно, если остаток пойдёт в следующий заказ.',
      b.sheets,
      b.unplaced,
    ),
    summarize(
      'shelves-h',
      'Рядами по высоте',
      'Детали выстраиваются горизонтальными рядами. Удобно пилить дисковой пилой ряд за рядом.',
      c.sheets,
      c.unplaced,
    ),
    summarize(
      'shelves-a',
      'Рядами, сначала крупные',
      'Сначала кладутся крупные детали, потом заполняются ряды. Баланс между отходами и удобством реза.',
      d.sheets,
      d.unplaced,
    ),
  ]

  // Лучший: меньше неразмещённых → меньше листов → выше КПИ → меньше отходов → плотнее укладка
  return variants.sort(
    (x, y) =>
      x.unplacedCount - y.unplacedCount ||
      x.sheetsUsed - y.sheetsUsed ||
      y.totalUsefulPercent - x.totalUsefulPercent ||
      x.totalWasteArea - y.totalWasteArea ||
      y.compactness - x.compactness,
  )
}
