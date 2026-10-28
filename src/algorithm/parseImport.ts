/**
 * Разбор текста и Excel/CSV в заготовки и отрезки.
 * Строка: длина [количество] [название]
 */
import * as XLSX from 'xlsx'
import type { PartItem, StockItem } from '../types'
import { asMeterLength, emptyPart, emptyStock, uid } from '../types'

export function parseNum(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  let cleaned = String(raw ?? '')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\s/g, '')
  cleaned = cleaned.replace(/mm|см|cm|м(?![a-zа-я])|m(?![a-z])|шт\.?|pcs\.?/gi, '')
  cleaned = cleaned.replace(/[−–—]/g, '-')
  if (cleaned === '-' || cleaned === '' || cleaned === '∞' || /^inf/i.test(cleaned)) return null

  // 1.234.567,89 — точка = тысячи, запятая = десятичная
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  }
  // 1,234,567 / 1,234,567.89 — несколько групп тысяч (US)
  else if (/^\d{1,3}(,\d{3}){2,}(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '')
  }
  // 1,234.56 — запятые тысяч + точка-десятичная (US)
  else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '')
  }
  // 7,900 / 11,7 / 3,14 — одна запятая = десятичная (как в русских файлах)
  else if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.')
  }

  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  // До тысячных: 7,904 → 7.904 (не 7904 и не 7.90)
  return Math.round(n * 1000) / 1000
}

function tokenizeLine(line: string): string[] {
  const t = line.trim()
  if (!t) return []

  if (t.includes('"') && /[;,]/.test(t)) {
    const cells: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < t.length; i++) {
      const ch = t[i]
      if (ch === '"') {
        if (inQ && t[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = !inQ
      } else if ((ch === ';' || ch === ',') && !inQ) {
        if (cur.trim()) cells.push(cur.trim())
        cur = ''
      } else cur += ch
    }
    if (cur.trim()) cells.push(cur.trim())
    if (cells.length >= 2) return cells
  }

  if (/[\t;]/.test(t)) {
    return t.split(/[\t;]+/).map((c) => c.trim()).filter(Boolean)
  }

  if (/\s/.test(t)) {
    return t.split(/\s+/).filter(Boolean)
  }

  if (t.includes(',')) {
    const parts = t.split(',').map((c) => c.trim()).filter(Boolean)
    if (parts.length === 2) {
      const a = parseNum(parts[0])
      const b = parseNum(parts[1])
      if (a !== null && b !== null && a === Math.floor(a) && b === Math.floor(b) && a >= 100) {
        return parts
      }
      return [t]
    }
    if (parts.length >= 3 && parseNum(parts[0]) !== null) return parts
  }

  return [t]
}

function detectHeader(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^\d/.test(t)) return false
  return /длина|length|qty|количеств|название|name|заготов|отрез|№|nomer|priority|очер[её]д|ширина|высота/i.test(
    t,
  )
}

type ColMap = { length: number; quantity: number; name: number }
type ParsedRow = { length: number; quantity: number | ''; name: string }

function mapHeaderColumns(cells: string[]): ColMap | null {
  const lower = cells.map((c) => c.toLowerCase().trim())
  const find = (...re: RegExp[]) => lower.findIndex((c) => re.some((r) => r.test(c)))

  const length = find(/^длина$/, /длина\b/, /^length$/, /\blen\b/)
  const quantity = find(/количеств/, /^кол-?во$/, /^qty$/, /^count$/, /^кол$/)
  const name = find(/название/, /^name$/, /наимен/, /материал/)

  if (length < 0 && quantity < 0) return null
  return {
    length: length >= 0 ? length : 0,
    quantity: quantity >= 0 ? quantity : length >= 0 ? length + 1 : 1,
    name: name >= 0 ? name : -1,
  }
}

function parseDataLine(line: string): ParsedRow | null {
  const raw = line.trim()
  if (!raw || raw.startsWith('#') || /^пример/i.test(raw)) return null
  if (detectHeader(raw)) return null

  const normalized = raw.replace(/\s*[-−–—]\s*/g, ' ')
  const cells = tokenizeLine(normalized)
  if (cells.length < 1) return null

  let offset = 0
  if (cells.length >= 3) {
    const a = parseNum(cells[0])
    const b = parseNum(cells[1])
    if (
      a !== null &&
      b !== null &&
      a === Math.floor(a) &&
      a >= 1 &&
      a <= 500 &&
      b > a &&
      b >= 10
    ) {
      offset = 1
    }
  }

  const length = parseNum(cells[offset])
  if (length === null || length <= 0) return null

  let quantity: number | '' = ''
  let idx = offset + 1
  if (cells.length > idx) {
    const q = parseNum(cells[idx])
    if (q !== null) {
      quantity = q
      idx += 1
    }
  }

  return {
    length,
    quantity,
    name: cells.slice(idx).join(' ').trim(),
  }
}

function rowFromCells(cells: (string | number)[], cols: ColMap | null): ParsedRow | null {
  if (cols) {
    const length = parseNum(cells[cols.length])
    if (length === null || length <= 0) return null
    const quantity = cols.quantity >= 0 ? parseNum(cells[cols.quantity]) : null
    const name =
      cols.name >= 0 && cells[cols.name] != null ? String(cells[cols.name]).trim() : ''
    return {
      length,
      quantity: quantity !== null && quantity > 0 ? quantity : quantity === 0 ? 0 : '',
      name,
    }
  }
  const line = cells.map((c) => String(c ?? '').trim()).filter(Boolean).join('\t')
  return parseDataLine(line)
}

function toStock(parsed: ParsedRow): StockItem {
  // Заготовки обычно вводят вручную; из файла не нормализуем «3115→3.115»
  return {
    id: uid('s'),
    length: Math.round(parsed.length * 1000) / 1000,
    quantity: parsed.quantity === 0 ? '' : parsed.quantity,
    name: parsed.name,
    priority: 0,
  }
}

function toPart(parsed: ParsedRow): PartItem {
  const q = parsed.quantity
  return {
    id: uid('p'),
    // Метры: 0,320 → 0.32; тысячные из Excel 320 → 0.32; 3115 → 3.115
    length: asMeterLength(parsed.length),
    quantity: q === '' || q === undefined || q <= 0 ? 1 : q,
    name: parsed.name,
  }
}

export function parseRowsAsStocks(text: string): StockItem[] {
  const rows: StockItem[] = []
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseDataLine(line)
    if (!parsed) continue
    rows.push(toStock(parsed))
  }
  return rows
}

export function parseRowsAsParts(text: string): PartItem[] {
  const rows: PartItem[] = []
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseDataLine(line)
    if (!parsed) continue
    rows.push(toPart(parsed))
  }
  return rows
}

/** Без секций: самые длинные → заготовки, иначе всё в отрезки. */
function splitAutoRows(parsedRows: ParsedRow[]): { stocks: StockItem[]; parts: PartItem[] } {
  if (!parsedRows.length) return { stocks: [], parts: [] }
  if (parsedRows.length === 1) {
    const r = parsedRows[0]
    if (r.quantity === '' && !r.name) return { stocks: [toStock(r)], parts: [] }
    return { stocks: [], parts: [toPart(r)] }
  }

  const lengths = parsedRows.map((r) => r.length).sort((a, b) => a - b)
  const maxLen = lengths[lengths.length - 1]
  const secondMax = lengths[lengths.length - 2] || 0
  const median = lengths[Math.floor(lengths.length / 2)]
  const hasClearStock = maxLen >= median * 1.8 && maxLen >= secondMax * 1.4

  if (!hasClearStock) {
    return { stocks: [], parts: parsedRows.map(toPart) }
  }

  const stockThreshold = maxLen * 0.9
  const stocks: StockItem[] = []
  const parts: PartItem[] = []
  for (const r of parsedRows) {
    if (r.length >= stockThreshold) stocks.push(toStock(r))
    else parts.push(toPart(r))
  }

  if (!parts.length || !stocks.length) return { stocks: [], parts: parsedRows.map(toPart) }
  return { stocks, parts }
}

export function parseImportText(text: string): { stocks: StockItem[]; parts: PartItem[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  let mode: 'auto' | 'stocks' | 'parts' = 'auto'
  const stockRows: StockItem[] = []
  const partRows: PartItem[] = []
  const autoBuf: ParsedRow[] = []

  const flushAuto = () => {
    if (!autoBuf.length) return
    const split = splitAutoRows(autoBuf)
    stockRows.push(...split.stocks)
    partRows.push(...split.parts)
    autoBuf.length = 0
  }

  for (const line of lines) {
    const lower = line.toLowerCase()
    if (/заготов|склад|stock|source/i.test(lower) && !/\d/.test(line)) {
      flushAuto()
      mode = 'stocks'
      continue
    }
    if (/отрез|part|детал/i.test(lower) && !/\d/.test(line)) {
      flushAuto()
      mode = 'parts'
      continue
    }

    const parsed = parseDataLine(line)
    if (!parsed) continue

    if (mode === 'stocks') {
      stockRows.push(toStock(parsed))
    } else if (mode === 'parts') {
      partRows.push(toPart(parsed))
    } else {
      autoBuf.push(parsed)
    }
  }
  flushAuto()

  return { stocks: stockRows, parts: partRows }
}

function sheetToMatrix(sheet: XLSX.WorkSheet): (string | number)[][] {
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as (string | number | null | undefined)[][]

  return rows.map((row) =>
    (row || []).map((cell) => {
      if (cell == null || cell === '') return ''
      if (typeof cell === 'number') return cell
      return String(cell).trim()
    }),
  )
}

function parseMatrix(
  matrix: (string | number)[][],
  force: 'stocks' | 'parts' | 'auto',
): { stocks: StockItem[]; parts: PartItem[] } {
  if (!matrix.length) return { stocks: [], parts: [] }

  const first = matrix[0].map((c) => String(c))
  const header = detectHeader(first.join(' '))
  const cols = header ? mapHeaderColumns(first) : null
  const dataRows = header ? matrix.slice(1) : matrix

  const parsedRows: ParsedRow[] = []
  for (const row of dataRows) {
    if (!row.some((c) => String(c).trim() !== '')) continue
    const p = rowFromCells(row, cols)
    if (p) parsedRows.push(p)
  }

  if (force === 'stocks') return { stocks: parsedRows.map(toStock), parts: [] }
  if (force === 'parts') return { stocks: [], parts: parsedRows.map(toPart) }
  return splitAutoRows(parsedRows)
}

export async function parseSpreadsheetFile(
  file: File,
  target: 'stocks' | 'parts' | 'auto' = 'auto',
): Promise<{ stocks: StockItem[]; parts: PartItem[] }> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.csv')) {
    const text = await file.text()
    if (target === 'stocks') return { stocks: parseRowsAsStocks(text), parts: [] }
    if (target === 'parts') return { stocks: [], parts: parseRowsAsParts(text) }
    return parseImportText(text)
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const stocks: StockItem[] = []
  const parts: PartItem[] = []
  const unlabeled: { stocks: StockItem[]; parts: PartItem[] }[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const matrix = sheetToMatrix(sheet)
    if (!matrix.length) continue

    if (/заготов|склад|stock|source/i.test(sheetName)) {
      const r = parseMatrix(matrix, 'stocks')
      stocks.push(...r.stocks)
    } else if (/отрез|part|детал/i.test(sheetName)) {
      const r = parseMatrix(matrix, 'parts')
      parts.push(...r.parts)
    } else if (target === 'stocks') {
      const r = parseMatrix(matrix, 'stocks')
      stocks.push(...r.stocks)
    } else if (target === 'parts') {
      const r = parseMatrix(matrix, 'parts')
      parts.push(...r.parts)
    } else {
      unlabeled.push(parseMatrix(matrix, 'auto'))
    }
  }

  for (const u of unlabeled) {
    stocks.push(...u.stocks)
    parts.push(...u.parts)
  }

  if (target === 'auto' && !stocks.length && !parts.length) {
    const allLines: string[] = []
    for (const sheetName of workbook.SheetNames) {
      const matrix = sheetToMatrix(workbook.Sheets[sheetName])
      for (const row of matrix) {
        const line = row.map((c) => String(c ?? '').trim()).filter(Boolean).join('\t')
        if (line) allLines.push(line)
      }
    }
    return parseImportText(allLines.join('\n'))
  }

  return { stocks, parts }
}

export function withTrailingEmptyStock(rows: StockItem[]): StockItem[] {
  return [...rows, emptyStock()]
}

export function withTrailingEmptyPart(rows: PartItem[]): PartItem[] {
  return [...rows, emptyPart()]
}

export const IMPORT_STOCK_EXAMPLE = `6000 32 доска 6м
5000 12 доска 5м`

export const IMPORT_PART_EXAMPLE = `0,320 1164
0,365 980
0,365 392
3,115 20`
