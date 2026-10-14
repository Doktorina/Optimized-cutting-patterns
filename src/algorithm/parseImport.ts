/**
 * Разбор текста и Excel/CSV в заготовки и отрезки.
 *
 * Строка: длина [количество] [название]
 * Секции по заголовкам «Заготовки» / «Отрезки» или имени листа.
 * Пример для UI: IMPORT_STOCK_EXAMPLE / IMPORT_PART_EXAMPLE.
 */
import * as XLSX from 'xlsx'
import type { PartItem, StockItem } from '../types'
import { emptyPart, emptyStock, uid } from '../types'

function parseNum(raw: string): number | null {
  let cleaned = String(raw ?? '')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\s/g, '')
  cleaned = cleaned.replace(/mm|см|cm|м(?![a-zа-я])|m(?![a-z])|шт\.?|pcs\.?/gi, '')
  cleaned = cleaned.replace(/[−–—]/g, '-')
  if (cleaned === '-' || cleaned === '' || cleaned === '∞' || /^inf/i.test(cleaned)) return null
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '')
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.')
  }
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function tokenizeLine(line: string): string[] {
  const t = line.trim()
  if (!t) return []
  if (/^".*"$/.test(t) || (t.includes('"') && /[;,]/.test(t))) {
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
    if (cells.length) return cells
  }
  if (/[\t;]/.test(t)) {
    return t.split(/[\t;]+/).map((c) => c.trim()).filter(Boolean)
  }
  if (/^\s*\d/.test(t) && (t.match(/,/g) || []).length >= 1 && !/\s/.test(t.split(',')[0])) {
    const parts = t.split(',').map((c) => c.trim()).filter(Boolean)
    if (parts.length >= 2 && parseNum(parts[0]) !== null) return parts
  }
  return t.split(/\s+/).filter(Boolean)
}

function parseDataLine(line: string): { length: number; quantity: number | ''; name: string } | null {
  const raw = line.trim()
  if (!raw || raw.startsWith('#') || /^пример/i.test(raw)) return null
  if (detectHeader(raw)) return null

  const normalized = raw.replace(/\s*[-−–—]\s*/g, ' ')
  const cells = tokenizeLine(normalized)
  if (cells.length < 1) return null

  let offset = 0
  if (
    cells.length >= 3 &&
    parseNum(cells[0]) !== null &&
    parseNum(cells[1]) !== null &&
    Number(cells[0]) > 0 &&
    Number(cells[0]) < 1000 &&
    parseNum(cells[1])! >= 10
  ) {
    const a = parseNum(cells[0])!
    const b = parseNum(cells[1])!
    if (a === Math.floor(a) && a <= 500 && b > a) offset = 1
  }

  const length = parseNum(cells[offset])
  if (length === null || length <= 0) return null

  let quantity: number | '' = ''
  let nameStart = offset + 1
  if (cells.length > offset + 1) {
    const q = parseNum(cells[offset + 1])
    if (q !== null) {
      quantity = q
      nameStart = offset + 2
    }
  }
  const name = cells.slice(nameStart).join(' ')
  return { length, quantity, name }
}

export function parseRowsAsStocks(text: string): StockItem[] {
  const rows: StockItem[] = []
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseDataLine(line)
    if (!parsed) continue
    rows.push({
      id: uid('s'),
      length: parsed.length,
      quantity: parsed.quantity,
      name: parsed.name,
      priority: 0,
    })
  }
  return rows
}

export function parseRowsAsParts(text: string): PartItem[] {
  const rows: PartItem[] = []
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseDataLine(line)
    if (!parsed) continue
    rows.push({
      id: uid('p'),
      length: parsed.length,
      length2: '',
      quantity: parsed.quantity === '' || parsed.quantity <= 0 ? 1 : parsed.quantity,
      name: parsed.name,
    })
  }
  return rows
}

export function parseImportText(text: string): { stocks: StockItem[]; parts: PartItem[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))

  let mode: 'auto' | 'stocks' | 'parts' = 'auto'
  const stockRows: StockItem[] = []
  const partRows: PartItem[] = []

  for (const line of lines) {
    const lower = line.toLowerCase()
    if (/заготов|склад|stock|source/i.test(lower) && !/\d/.test(line)) {
      mode = 'stocks'
      continue
    }
    if (/отрез|part|детал/i.test(lower) && !/\d/.test(line)) {
      mode = 'parts'
      continue
    }

    const parsed = parseDataLine(line)
    if (!parsed) continue

    if (mode === 'stocks') {
      stockRows.push({
        id: uid('s'),
        length: parsed.length,
        quantity: parsed.quantity,
        name: parsed.name,
        priority: 0,
      })
    } else if (mode === 'parts') {
      partRows.push({
        id: uid('p'),
        length: parsed.length,
        length2: '',
        quantity: parsed.quantity === '' || parsed.quantity <= 0 ? 1 : parsed.quantity,
        name: parsed.name,
      })
    } else if (parsed.quantity === '' && !parsed.name) {
      stockRows.push({
        id: uid('s'),
        length: parsed.length,
        quantity: '',
        name: '',
        priority: 0,
      })
    } else {
      partRows.push({
        id: uid('p'),
        length: parsed.length,
        length2: '',
        quantity: parsed.quantity === '' || parsed.quantity <= 0 ? 1 : parsed.quantity,
        name: parsed.name,
      })
    }
  }

  return { stocks: stockRows, parts: partRows }
}

function sheetToLines(sheet: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as (string | number)[][]

  return rows
    .map((row) =>
      row
        .map((cell) => String(cell ?? '').trim())
        .filter((c) => c !== '')
        .join('\t'),
    )
    .filter(Boolean)
}

function detectHeader(line: string): boolean {
  const t = line.trim()
  if (/^\d/.test(t)) return false
  return /длина|length|qty|количеств|название|name|заготов|отрез|№|nomer|priority|очер[её]д/i.test(t)
}

export async function parseSpreadsheetFile(
  file: File,
  target: 'stocks' | 'parts' | 'auto' = 'auto',
): Promise<{ stocks: StockItem[]; parts: PartItem[] }> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const allLines: string[] = []
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const lines = sheetToLines(sheet)
    const start = lines.length && detectHeader(lines[0]) ? 1 : 0
    if (/заготов|склад|stock|source/i.test(name)) {
      allLines.push('Заготовки')
      allLines.push(...lines.slice(start))
    } else if (/отрез|part|детал/i.test(name)) {
      allLines.push('Отрезки')
      allLines.push(...lines.slice(start))
    } else {
      allLines.push(...lines.slice(start))
    }
  }

  const text = allLines.join('\n')

  if (target === 'stocks') {
    return { stocks: parseRowsAsStocks(text), parts: [] }
  }
  if (target === 'parts') {
    return { stocks: [], parts: parseRowsAsParts(text) }
  }
  return parseImportText(text)
}

export function withTrailingEmptyStock(rows: StockItem[]): StockItem[] {
  return [...rows, emptyStock()]
}

export function withTrailingEmptyPart(rows: PartItem[]): PartItem[] {
  return [...rows, emptyPart()]
}

export const IMPORT_STOCK_EXAMPLE = `6000 32 доска 6м
5000 12 доска 5м`

export const IMPORT_PART_EXAMPLE = `340 32 отрезок
48 24 отрезок-1
2260 22 отрезок-2
760 14 отрезок-3
1260 22 отрезок-4`
